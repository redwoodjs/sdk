import { loadCapnweb } from "./capnweb-loader.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

// Global flag so that once any use-synced-state endpoint detects a broken
// WebSocket/RPC session, the page reloads exactly once. A real deploy can drop
// multiple endpoint connections simultaneously; reloading once is enough.
let isReloadingForStaleClient = false;

export type SyncedStateStatus = "connected" | "disconnected";
export type StatusChangeCallback = (status: SyncedStateStatus) => void;

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

// Converts a relative endpoint like "/__synced-state" to an absolute
// ws:// or wss:// URL so the same key is used by getSyncedStateClient and
// onStatusChange notifications.
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

// Track active subscriptions per client for cleanup on page reload.
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
            // When the WebSocket/RPC session breaks, reload the page. In
            // practice this happens when the worker (and therefore the
            // Durable Object) restarts after a deploy. Rather than trying to
            // reconnect a stale client, we reload so the user gets the current
            // build and a fresh connection.
            notifyStatusChange(endpoint, "disconnected");
            if (isReloadingForStaleClient) {
              return;
            }
            isReloadingForStaleClient = true;
            window.location.reload();
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
  // onRpcBroken handler) is ready as soon as possible. Errors are swallowed
  // here to avoid unhandled rejections — they still surface through subsequent
  // method calls because the rejected promise remains cached.
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
  const normalized = normalizeEndpoint(endpoint);
  if (client) {
    clientCache.set(normalized, client);
  } else {
    clientCache.delete(normalized);
  }
  baseClientPromiseByEndpoint.delete(normalized);
  activeSubscriptions.clear();
  statusListeners.clear();
  // Reset the reload guard so tests that trigger a broken session don't leak
  // state into subsequent tests.
  isReloadingForStaleClient = false;
};

// Exported for testing only
export const __testing = {
  activeSubscriptions,
  clientCache,
  statusListeners,
  // Awaits the eagerly-kicked-off capnweb load for a cached client. Tests
  // should `await __testing.warmUp(endpoint)` after `getSyncedStateClient`
  // when they need the underlying session to exist before asserting on it.
  async warmUp(endpoint: string = DEFAULT_SYNCED_STATE_PATH): Promise<void> {
    const normalized = normalizeEndpoint(endpoint);
    const promise = baseClientPromiseByEndpoint.get(normalized);
    if (promise) {
      await promise.catch(() => {});
    }
  },
};
