import { newWebSocketRpcSession } from "capnweb";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

let cachedClient: SyncedStateClient | null = null;

let cachedEndpoint = DEFAULT_SYNCED_STATE_PATH;

/**
 * Returns a cached client for the provided endpoint, creating it when necessary.
 * @param endpoint Endpoint to connect to.
 * @returns RPC client instance.
 */
export const getSyncedStateClient = (
  endpoint: string = cachedEndpoint,
): SyncedStateClient => {
  if (cachedClient && endpoint === cachedEndpoint) {
    return cachedClient;
  }
  cachedEndpoint = endpoint;

  cachedClient = newWebSocketRpcSession(
    cachedEndpoint,
  ) as unknown as SyncedStateClient;
  return cachedClient;
};

/**
 * Initializes and caches an RPC client instance for the sync state endpoint.
 * @param options Optional endpoint override.
 * @returns Cached client instance or `null` when running without `window`.
 */
export const initSyncedStateClient = (options: { endpoint?: string } = {}) => {
  cachedEndpoint = options.endpoint ?? DEFAULT_SYNCED_STATE_PATH;
  if (typeof window === "undefined") {
    return null;
  }
  cachedClient = newWebSocketRpcSession(
    cachedEndpoint,
  ) as unknown as SyncedStateClient;
  return cachedClient;
};

/**
 * Injects a client instance for tests and updates the cached endpoint.
 * @param client Stub client instance or `null` to clear the cache.
 * @param endpoint Endpoint associated with the injected client.
 */
export const setSyncedStateClientForTesting = (
  client: SyncedStateClient | null,
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
) => {
  cachedClient = client;
  cachedEndpoint = endpoint;
};

