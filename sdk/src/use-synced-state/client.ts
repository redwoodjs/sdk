import { newWebSocketRpcSession } from "capnweb";
import { DEFAULT_SYNC_STATE_PATH } from "./constants.mjs";
export type SyncStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

type InitOptions = {
  endpoint?: string;
};

let cachedClient: SyncStateClient | null = null;

let cachedEndpoint = DEFAULT_SYNC_STATE_PATH;

/**
 * Initializes and caches an RPC client instance for the sync state endpoint.
 * @param options Optional endpoint override.
 * @returns Cached client instance or `null` when running without `window`.
 */
export const initSyncStateClient = (options: InitOptions = {}) => {
  cachedEndpoint = options.endpoint ?? DEFAULT_SYNC_STATE_PATH;
  if (typeof window === "undefined") {
    return null;
  }
  cachedClient = newWebSocketRpcSession(
    cachedEndpoint,
  ) as unknown as SyncStateClient;
  return cachedClient;
};

/**
 * Returns a cached client for the provided endpoint, creating it when necessary.
 * @param endpoint Endpoint to connect to.
 * @returns RPC client instance.
 */
export const getSyncStateClient = (
  endpoint: string = cachedEndpoint,
): SyncStateClient => {
  if (cachedClient && endpoint === cachedEndpoint) {
    return cachedClient;
  }
  cachedEndpoint = endpoint;

  cachedClient = newWebSocketRpcSession(
    cachedEndpoint,
  ) as unknown as SyncStateClient;
  return cachedClient;
};

/**
 * Injects a client instance for tests and updates the cached endpoint.
 * @param client Stub client instance or `null` to clear the cache.
 * @param endpoint Endpoint associated with the injected client.
 */
export const setSyncStateClientForTesting = (
  client: SyncStateClient | null,
  endpoint: string = DEFAULT_SYNC_STATE_PATH,
) => {
  cachedClient = client;
  cachedEndpoint = endpoint;
};
