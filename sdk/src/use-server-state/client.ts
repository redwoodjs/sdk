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

export const setSyncStateClientForTesting = (
  client: SyncStateClient | null,
  endpoint: string = DEFAULT_SYNC_STATE_PATH,
) => {
  cachedClient = client;
  cachedEndpoint = endpoint;
};
