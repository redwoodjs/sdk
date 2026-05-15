import { loadCapnweb } from "./capnweb-loader.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export type SyncedStateStatus = "connected" | "disconnected" | "reconnecting";
export type StatusChangeCallback = (status: SyncedStateStatus) => void;

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

// Converts a relative endpoint like "/__synced-state" to an absolute
// ws:// or wss:// URL so the same key is used by getSyncedStateClient,
// onStatusChange, and reconnect notifications.
function normalizeEndpoint(endpoint: string): string {
  if (endpoint.startsWith("/") && typeof window !== "undefined") {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}${endpoint}`;
  }
  return endpoint;
}

// Map of endpoint URLs to their respective clients
const clientCache = new Map<string, SyncedStateClient>();

// Tracks the promise of the underlying capnweb session per endpoint, exposed
// for tests so they can `await` the lazy load before making assertions.
const baseClientPromiseByEndpoint = new Map<string, Promise<unknown>>();

// Track active subscriptions per client for cleanup on page reload
// and for re-subscribing after reconnection
type Subscription = {
  key: string;
  handler: (value: unknown) => void;
  client: SyncedStateClient;
};

const activeSubscriptions = new Set<Subscription>();

// Status change listeners per endpoint. Uses an array rather than a Set so
// that two components passing the same callback reference (e.g. via
// createSyncedStateHook({ onStatusChange })) are tracked as two separate
// registrations — unsubscribing one must not cancel the other.
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
const backoffState = new Map<string, { attempt: number; timer: ReturnType<typeof setTimeout> | null }>();

const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

function getBackoffMs(attempt: number): number {
  const base = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  // Add ±25% jitter to avoid thundering herd on server restart
  const jittered = base * (0.75 + Math.random() * 0.5);
  return Math.round(Math.min(jittered, MAX_BACKOFF_MS));
}

// Set up beforeunload handler to unsubscribe all active subscriptions
if (typeof window !== "undefined") {
  const handleBeforeUnload = () => {
    if (activeSubscriptions.size === 0) {
      return;
    }

    // Unsubscribe all active subscriptions
    // Use a synchronous approach where possible, but don't block page unload
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

function reconnect(endpoint: string, deadClient: SyncedStateClient) {
  // Don't schedule multiple reconnects for the same endpoint
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

    // Evict the dead client so getSyncedStateClient creates a fresh one
    clientCache.delete(endpoint);
    const newClient = getSyncedStateClient(endpoint);

    // Re-subscribe everything that was on the dead client. Kick off both
    // subscribe() and getState() synchronously so callers see the calls
    // happen inside the timer tick, but only confirm "connected" once the
    // subscribe promises resolve — otherwise a rejected resubscription
    // would be masked as a successful reconnect.
    const subscribePromises: Promise<void>[] = [];
    for (const sub of activeSubscriptions) {
      if (sub.client === deadClient) {
        sub.client = newClient;
        subscribePromises.push(newClient.subscribe(sub.key, sub.handler));
        void newClient.getState(sub.key).then((val) => {
          if (val !== undefined) {
            sub.handler(val);
          }
        });
      }
    }

    Promise.all(subscribePromises).then(
      () => {
        backoffState.set(endpoint, { attempt: 0, timer: null });
        notifyStatusChange(endpoint, "connected");
      },
      () => {
        // Resubscription failed — leave the attempt counter elevated so
        // the next reconnect uses a longer backoff, and emit disconnected
        // again. A subsequent onRpcBroken from the new (likely dead)
        // client will drive the next retry.
        notifyStatusChange(endpoint, "disconnected");
      },
    );
  }, delayMs);

  backoffState.set(endpoint, state);
}

/**
 * Returns a cached client for the provided endpoint, creating it when necessary.
 * The returned client is a proxy that loads `capnweb` lazily on first method
 * call — consumers that never hit `use-synced-state` pay no import cost and
 * don't need `capnweb` installed.
 * @param endpoint Endpoint to connect to.
 * @returns RPC client instance.
 */
export const getSyncedStateClient = (
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
): SyncedStateClient => {
  // Convert relative endpoint to absolute URL for environments like WKWebView
  endpoint = normalizeEndpoint(endpoint);

  // Return existing client if already cached for this endpoint
  const existingClient = clientCache.get(endpoint);
  if (existingClient) {
    return existingClient;
  }

  let baseClientPromise: Promise<any> | null = null;
  let wrappedClient!: SyncedStateClient;

  const getBaseClient = (): Promise<any> => {
    if (!baseClientPromise) {
      baseClientPromise = loadCapnweb().then((mod) => {
        const session = mod.newWebSocketRpcSession(endpoint);
        if (typeof (session as any).onRpcBroken === "function") {
          (session as any).onRpcBroken(() => {
            reconnect(endpoint, wrappedClient);
          });
        }
        return session;
      });
      baseClientPromiseByEndpoint.set(endpoint, baseClientPromise);
    }
    return baseClientPromise;
  };

  wrappedClient = new Proxy({} as SyncedStateClient, {
    get(_target, prop) {
      if (prop === "subscribe") {
        return async (key: string, handler: (value: unknown) => void) => {
          const subscription: Subscription = {
            key,
            handler,
            client: wrappedClient,
          };
          activeSubscriptions.add(subscription);
          const base = await getBaseClient();
          return base[prop](key, handler);
        };
      }
      if (prop === "unsubscribe") {
        return async (key: string, handler: (value: unknown) => void) => {
          // Find and remove the subscription
          for (const sub of activeSubscriptions) {
            if (
              sub.key === key &&
              sub.handler === handler &&
              sub.client === wrappedClient
            ) {
              activeSubscriptions.delete(sub);
              break;
            }
          }
          const base = await getBaseClient();
          return base[prop](key, handler);
        };
      }
      // Pass through all other properties/methods
      return async (...args: unknown[]) => {
        const base = await getBaseClient();
        return base[prop as string](...args);
      };
    },
  }) as SyncedStateClient;

  // Cache the client for this endpoint
  clientCache.set(endpoint, wrappedClient);

  // Eagerly kick off the capnweb load so the underlying session (and its
  // onRpcBroken handler) is ready as soon as possible, and reconnect flows
  // that don't call methods on the new client still create the replacement
  // session. Errors are swallowed here to avoid unhandled rejections — they
  // still surface through subsequent method calls because the rejected
  // promise remains cached.
  void getBaseClient().catch(() => {});

  return wrappedClient;
};

/**
 * Initializes and caches an RPC client instance for the sync state endpoint.
 * The client is wrapped to track subscriptions for cleanup on page reload.
 * @param options Optional endpoint override.
 * @returns Cached client instance or `null` when running without `window`.
 */
export const initSyncedStateClient = (options: { endpoint?: string } = {}) => {
  const endpoint = options.endpoint ?? DEFAULT_SYNCED_STATE_PATH;
  if (typeof window === "undefined") {
    return null;
  }
  // Use getSyncedStateClient which now handles caching via Map
  return getSyncedStateClient(endpoint);
};

/**
 * Injects a client instance for tests and updates the cached endpoint.
 * Also clears the subscription registry for test isolation.
 * @param client Stub client instance or `null` to clear the cache.
 * @param endpoint Endpoint associated with the injected client.
 */
export const setSyncedStateClientForTesting = (
  client: SyncedStateClient | null,
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
) => {
  if (client) {
    clientCache.set(endpoint, client);
  } else {
    clientCache.delete(endpoint);
  }
  baseClientPromiseByEndpoint.delete(endpoint);
  activeSubscriptions.clear();
  statusListeners.clear();
  // Clear any pending reconnection timers
  for (const [, state] of backoffState) {
    if (state.timer !== null) {
      clearTimeout(state.timer);
    }
  }
  backoffState.clear();
};

// Exported for testing only
export const __testing = {
  activeSubscriptions,
  clientCache,
  backoffState,
  statusListeners,
  reconnect,
  getBackoffMs,
  // Awaits the eagerly-kicked-off capnweb load for a cached client. Tests
  // should `await __testing.warmUp(endpoint)` after `getSyncedStateClient`
  // (or after a reconnect) when they need the underlying session to exist
  // before asserting on it.
  async warmUp(endpoint: string = DEFAULT_SYNCED_STATE_PATH): Promise<void> {
    const normalized = normalizeEndpoint(endpoint);
    const promise = baseClientPromiseByEndpoint.get(normalized);
    if (promise) {
      await promise.catch(() => {});
    }
  },
};
