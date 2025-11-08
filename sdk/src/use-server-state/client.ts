import { newWebSocketRpcSession } from "capnweb";
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
const DEFAULT_SYNC_STATE_PATH = "/__sync-state";

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

export const getSyncStateClient = (): SyncStateClient => {
  if (cachedClient) {
    return cachedClient;
  }
  if (typeof window === "undefined") {
    throw new Error(
      "initSyncStateClient must be called before using useSyncState",
    );
  }
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
