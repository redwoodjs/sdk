import { newWebSocketRpcSession } from "capnweb";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

// Map of endpoint URLs to their respective clients
const clientCache = new Map<string, SyncedStateClient>();

// Track active subscriptions per client for cleanup on page reload
type Subscription = {
  key: string;
  handler: (value: unknown) => void;
  client: SyncedStateClient;
};

const activeSubscriptions = new Set<Subscription>();

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
 * The client is wrapped to track subscriptions for cleanup on page reload.
 * @param endpoint Endpoint to connect to.
 * @returns RPC client instance.
 */
export const getSyncedStateClient = (
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
): SyncedStateClient => {
  // Return existing client if already cached for this endpoint
  const existingClient = clientCache.get(endpoint);
  if (existingClient) {
    return existingClient;
  }

  const baseClient = newWebSocketRpcSession(
    endpoint,
  ) as unknown as SyncedStateClient;

  // Wrap the client using a Proxy to track subscriptions
  // The RPC client uses dynamic property access, so we can't use .bind()
  const wrappedClient = new Proxy(baseClient, {
    get(target, prop) {
      if (prop === "subscribe") {
        return async (key: string, handler: (value: unknown) => void) => {
          const subscription: Subscription = {
            key,
            handler,
            client: wrappedClient,
          };
          activeSubscriptions.add(subscription);
          return (target as any)[prop](key, handler);
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
          return (target as any)[prop](key, handler);
        };
      }
      // Pass through all other properties/methods
      return (target as any)[prop];
    },
  }) as SyncedStateClient;

  // Cache the client for this endpoint
  clientCache.set(endpoint, wrappedClient);

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
  activeSubscriptions.clear();
};
