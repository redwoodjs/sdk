import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";
import {
  type ClientMessage,
  type ServerMessage,
  packMessage,
  unpackServerMessage,
} from "./protocol-hibernation.mjs";

export type SyncedStateStatus = "connected" | "disconnected" | "reconnecting";
export type StatusChangeCallback = (status: SyncedStateStatus) => void;

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

export type WebSocketFactory = (url: string) => WebSocket;

// Converts a relative endpoint like "/__synced-state" to an absolute
// ws:// or wss:// URL.
function normalizeEndpoint(endpoint: string): string {
  if (endpoint.startsWith("/") && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${endpoint}`;
  }
  return endpoint;
}

// Map of endpoint URLs to their respective clients
const clientCache = new Map<string, SyncedStateClient>();

// Tracks the underlying WebSocket connection and pending requests per endpoint.
type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
};

type Connection = {
  ws: WebSocket;
  nextId: number;
  pending: Map<string, PendingRequest>;
  isOpen: boolean;
  subscribedKeys: Set<string>;
  messageHandlers: Map<string, Set<(value: unknown) => void>>;
  deadConnectionTimer: ReturnType<typeof setTimeout> | null;
  lastMessageAt: number;
};

const connectionByEndpoint = new Map<string, Connection>();

// Track active subscriptions per client for cleanup on page reload
// and for re-subscribing after reconnection
type Subscription = {
  key: string;
  handler: (value: unknown) => void;
  client: SyncedStateClient;
};

const activeSubscriptions = new Set<Subscription>();

// Status change listeners per endpoint. Uses an array rather than a Set so
// that two components passing the same callback reference are tracked as two
// separate registrations.
const statusListeners = new Map<string, StatusChangeCallback[]>();

function notifyStatusChange(endpoint: string, status: SyncedStateStatus) {
  const listeners = statusListeners.get(endpoint);
  if (listeners) {
    // Snapshot so unsubscribes fired by callbacks don't skip entries.
    for (const cb of [...listeners]) {
      cb(status);
    }
  }
}

/**
 * Registers a callback that fires when the connection status changes for an endpoint.
 * Returns an unsubscribe function.
 */
export const onStatusChange = (
  endpoint: string,
  callback: StatusChangeCallback,
): (() => void) => {
  const normalized = normalizeEndpoint(endpoint);
  let listeners = statusListeners.get(normalized);
  if (!listeners) {
    listeners = [];
    statusListeners.set(normalized, listeners);
  }
  listeners.push(callback);
  return () => {
    const idx = listeners!.indexOf(callback);
    if (idx !== -1) {
      listeners!.splice(idx, 1);
    }
    if (listeners!.length === 0) {
      statusListeners.delete(normalized);
    }
  };
};

// Tracks per-endpoint reconnection backoff state
const backoffState = new Map<
  string,
  { attempt: number; timer: ReturnType<typeof setTimeout> | null }
>();

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

function getBackoffMs(attempt: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.round(Math.min(jittered, MAX_BACKOFF_MS));
}

// Set up beforeunload handler to unsubscribe all active subscriptions
if (typeof window !== "undefined") {
  const handleBeforeUnload = () => {
    if (activeSubscriptions.size === 0) {
      return;
    }

    const subscriptions = Array.from(activeSubscriptions);
    activeSubscriptions.clear();

    // Fire-and-forget unsubscribe calls - we can't await during beforeunload
    for (const { key, handler, client } of subscriptions) {
      void client.unsubscribe(key, handler).catch(() => {
        // Ignore errors during page unload - the connection will be closed anyway
      });
    }
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
}

function makeMessageId(connection: Connection): string {
  return `${connection.nextId++}`;
}

function getConnection(
  endpoint: string,
  webSocketFactory: WebSocketFactory,
): Connection {
  const normalized = normalizeEndpoint(endpoint);
  let connection = connectionByEndpoint.get(normalized);
  if (!connection) {
    connection = createConnection(normalized, webSocketFactory);
    connectionByEndpoint.set(normalized, connection);
  }
  return connection;
}

const DEAD_CONNECTION_TIMEOUT_MS = 90_000;

function resetDeadConnectionTimer(connection: Connection, endpoint: string) {
  if (connection.deadConnectionTimer) {
    clearTimeout(connection.deadConnectionTimer);
  }
  connection.deadConnectionTimer = setTimeout(() => {
    // No message received in a long time; the socket may be silently dead.
    // Force close so the close handler drives reconnection.
    try {
      connection.ws.close();
    } catch {
      // ignore
    }
    // Ensure reconnection still happens even if close event doesn't fire.
    connection.isOpen = false;
    connection.pending.forEach((pending) => {
      pending.reject(new Error("WebSocket timed out"));
    });
    connection.pending.clear();
    cleanupConnectionTimers(connection);
    connectionByEndpoint.delete(endpoint);
    reconnect(endpoint);
  }, DEAD_CONNECTION_TIMEOUT_MS);
}

function cleanupConnectionTimers(connection: Connection) {
  if (connection.deadConnectionTimer) {
    clearTimeout(connection.deadConnectionTimer);
    connection.deadConnectionTimer = null;
  }
}

function createConnection(
  endpoint: string,
  webSocketFactory: WebSocketFactory,
): Connection {
  const connection: Connection = {
    ws: webSocketFactory(endpoint),
    nextId: 0,
    pending: new Map(),
    isOpen: false,
    subscribedKeys: new Set(),
    messageHandlers: new Map(),
    deadConnectionTimer: null,
    lastMessageAt: Date.now(),
  };

  connection.ws.addEventListener("open", () => {
    connection.isOpen = true;
    connection.lastMessageAt = Date.now();
    notifyStatusChange(endpoint, "connected");
    backoffState.set(endpoint, { attempt: 0, timer: null });

    resetDeadConnectionTimer(connection, endpoint);

    // Re-subscribe to all active keys for this endpoint
    for (const sub of activeSubscriptions) {
      const subEndpoint = normalizeEndpoint(
        (sub.client as any).__endpoint ?? endpoint,
      );
      if (subEndpoint === endpoint) {
        void sendMessage(connection, {
          kind: "subscribe",
          key: sub.key,
          id: makeMessageId(connection),
        }).catch(() => {
          // Close handler will drive reconnection if this fails.
        });
        void sendMessage(connection, {
          kind: "getState",
          key: sub.key,
          id: makeMessageId(connection),
        })
          .then((value) => {
            if (value !== undefined) {
              sub.handler(value);
            }
          })
          .catch(() => {
            // Close handler will drive reconnection if this fails.
          });
      }
    }
  });

  connection.ws.addEventListener("message", (event) => {
    connection.lastMessageAt = Date.now();
    resetDeadConnectionTimer(connection, endpoint);

    if (typeof event.data !== "string") {
      return;
    }

    let message: ServerMessage;
    try {
      message = unpackServerMessage(event.data);
    } catch {
      return;
    }

    if (message.kind === "update") {
      const handlers = connection.messageHandlers.get(message.key);
      if (handlers) {
        for (const handler of handlers) {
          handler(message.value);
        }
      }
      return;
    }

    if (message.kind === "error") {
      if (message.id !== undefined) {
        const pending = connection.pending.get(message.id);
        if (pending) {
          connection.pending.delete(message.id);
          pending.reject(new Error(message.message));
        }
      }
      return;
    }

    const pending = connection.pending.get(message.id);
    if (!pending) {
      return;
    }
    connection.pending.delete(message.id);

    if (message.kind === "getState") {
      pending.resolve(message.value);
    } else {
      pending.resolve(undefined);
    }
  });

  connection.ws.addEventListener("close", () => {
    connection.isOpen = false;
    cleanupConnectionTimers(connection);

    for (const pending of connection.pending.values()) {
      pending.reject(new Error("WebSocket closed"));
    }
    connection.pending.clear();
    connectionByEndpoint.delete(endpoint);
    reconnect(endpoint);
  });

  connection.ws.addEventListener("error", () => {
    // Close event will fire next and drive reconnection.
  });

  return connection;
}

function sendMessage(
  connection: Connection,
  message: ClientMessage,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (connection.isOpen) {
      connection.pending.set(message.id, { resolve, reject });
      connection.ws.send(packMessage(message));
      return;
    }

    const onOpen = () => {
      connection.ws.removeEventListener("open", onOpen);
      connection.pending.set(message.id, { resolve, reject });
      connection.ws.send(packMessage(message));
    };

    const onClose = () => {
      connection.ws.removeEventListener("open", onOpen);
      connection.ws.removeEventListener("close", onClose);
      reject(new Error("WebSocket closed before message could be sent"));
    };

    connection.ws.addEventListener("open", onOpen);
    connection.ws.addEventListener("close", onClose);
  });
}

function reconnect(endpoint: string) {
  const state = backoffState.get(endpoint) ?? { attempt: 0, timer: null };
  if (state.timer !== null) {
    return;
  }

  notifyStatusChange(endpoint, "disconnected");

  const delayMs = getBackoffMs(state.attempt);
  state.timer = setTimeout(() => {
    state.timer = null;
    state.attempt++;
    backoffState.set(endpoint, state);

    notifyStatusChange(endpoint, "reconnecting");

    // Evict the dead connection so getConnection creates a fresh one
    const deadConnection = connectionByEndpoint.get(endpoint);
    if (deadConnection) {
      try {
        deadConnection.ws.close();
      } catch {
        // ignore
      }
      connectionByEndpoint.delete(endpoint);
    }

    // Reuse the same WebSocket factory that the original client was created
    // with (production WebSocket, test ws.WebSocket, etc.).
    let webSocketFactory: WebSocketFactory = (url) => new WebSocket(url);
    for (const sub of activeSubscriptions) {
      const subEndpoint = normalizeEndpoint((sub.client as any).__endpoint);
      if (subEndpoint === endpoint) {
        const factory = (sub.client as any).__webSocketFactory as
          | WebSocketFactory
          | undefined;
        if (factory) {
          webSocketFactory = factory;
          break;
        }
      }
    }

    const newConnection = getConnection(endpoint, webSocketFactory);

    newConnection.ws.addEventListener(
      "open",
      () => {
        backoffState.set(endpoint, { attempt: 0, timer: null });
        // The connection's own open handler already notifies "connected" and
        // re-subscribes; avoid doing it twice here.
      },
      { once: true },
    );

    newConnection.ws.addEventListener(
      "close",
      () => {
        notifyStatusChange(endpoint, "disconnected");
      },
      { once: true },
    );
  }, delayMs);

  backoffState.set(endpoint, state);
}

/**
 * Returns a cached client for the provided endpoint, creating it when necessary.
 * The returned client is a thin wrapper around a raw WebSocket that speaks the
 * hibernation JSON protocol.
 */
export const getSyncedStateClient = (
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
  webSocketFactory: WebSocketFactory = (url) => new WebSocket(url),
): SyncedStateClient => {
  const normalized = normalizeEndpoint(endpoint);

  const existingClient = clientCache.get(normalized);
  if (existingClient) {
    return existingClient;
  }

  const client: SyncedStateClient = {
    async getState(key: string): Promise<unknown> {
      const connection = getConnection(normalized, webSocketFactory);
      const id = makeMessageId(connection);
      return sendMessage(connection, { kind: "getState", key, id });
    },

    async setState(value: unknown, key: string): Promise<void> {
      const connection = getConnection(normalized, webSocketFactory);
      const id = makeMessageId(connection);
      await sendMessage(connection, { kind: "setState", key, value, id });
    },

    async subscribe(
      key: string,
      handler: (value: unknown) => void,
    ): Promise<void> {
      const exists = [...activeSubscriptions].some(
        (s) => s.key === key && s.handler === handler && s.client === client,
      );
      if (!exists) {
        activeSubscriptions.add({ key, handler, client });
      }

      const connection = getConnection(normalized, webSocketFactory);
      let handlers = connection.messageHandlers.get(key);
      if (!handlers) {
        handlers = new Set();
        connection.messageHandlers.set(key, handlers);
      }
      handlers.add(handler);

      if (connection.isOpen) {
        const id = makeMessageId(connection);
        // Subscribe is fire-and-forget: the server does not send an ack, and
        // any missed subscribe is repaired by the reconnect re-subscribe path.
        connection.ws.send(packMessage({ kind: "subscribe", key, id }));
      }
    },

    async unsubscribe(
      key: string,
      handler: (value: unknown) => void,
    ): Promise<void> {
      for (const sub of [...activeSubscriptions]) {
        if (
          sub.key === key &&
          sub.handler === handler &&
          sub.client === client
        ) {
          activeSubscriptions.delete(sub);
        }
      }

      const connection = connectionByEndpoint.get(normalized);
      // Note: we intentionally do not await an unsubscribe response. The server
      // removes the subscription, and if the message is lost the close/reconnect
      // path will re-subscribe only keys that are still active.
      if (connection) {
        const handlers = connection.messageHandlers.get(key);
        if (handlers) {
          handlers.delete(handler);
          if (handlers.size === 0) {
            connection.messageHandlers.delete(key);
          }
        }

        if (connection.isOpen) {
          const id = makeMessageId(connection);
          // Fire-and-forget: the server removes the subscription, and if the
          // message is lost the close/reconnect path will re-subscribe only
          // keys that are still active.
          connection.ws.send(packMessage({ kind: "unsubscribe", key, id }));
        }
      }
    },
  };

  // Expose the endpoint and WebSocket factory so reconnect can recreate the
  // connection with the same dependencies the client was created with.
  (client as any).__endpoint = endpoint;
  (client as any).__webSocketFactory = webSocketFactory;

  clientCache.set(normalized, client);
  return client;
};

/**
 * Initializes and caches an RPC client instance for the sync state endpoint.
 * The client is wrapped to track subscriptions for cleanup on page unload.
 */
export const initSyncedStateClient = (
  options: { endpoint?: string; webSocketFactory?: WebSocketFactory } = {},
) => {
  const endpoint = options.endpoint ?? DEFAULT_SYNCED_STATE_PATH;
  if (typeof window === "undefined") {
    return null;
  }
  return getSyncedStateClient(
    endpoint,
    options.webSocketFactory ?? ((url) => new WebSocket(url)),
  );
};

/**
 * Injects a client instance for tests and updates the cached endpoint.
 * Also clears the subscription registry for test isolation.
 */
export const setSyncedStateClientForTesting = (
  client: SyncedStateClient | null,
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
) => {
  const normalized = normalizeEndpoint(endpoint);
  if (client) {
    clientCache.set(normalized, client);
  } else {
    clientCache.delete(normalized);
  }
  const connection = connectionByEndpoint.get(normalized);
  if (connection) {
    cleanupConnectionTimers(connection);
    try {
      connection.ws.close();
    } catch {
      // ignore
    }
    connectionByEndpoint.delete(normalized);
  }
  activeSubscriptions.clear();
  statusListeners.clear();
  for (const [, state] of backoffState) {
    if (state.timer !== null) {
      clearTimeout(state.timer);
    }
  }
  backoffState.clear();
};

// Exported for testing only
export const __testing = {
  getBackoffMs,
  DEAD_CONNECTION_TIMEOUT_MS,
};
