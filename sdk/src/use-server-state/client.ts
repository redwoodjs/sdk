import { newWebSocketRpcSession } from "capnweb";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export type SyncedStateClient = {
  getState(key: string): Promise<unknown>;
  setState(value: unknown, key: string): Promise<void>;
  subscribe(key: string, handler: (value: unknown) => void): Promise<void>;
  unsubscribe(key: string, handler: (value: unknown) => void): Promise<void>;
};

type InitOptions = {
  endpoint?: string;
};

let cachedClient: SyncedStateClient | null = null;
let cachedEndpoint = DEFAULT_SYNCED_STATE_PATH;

export const initSyncedStateClient = (options: InitOptions = {}) => {
  cachedEndpoint = options.endpoint ?? DEFAULT_SYNCED_STATE_PATH;
  if (typeof window === "undefined") {
    return null;
  }
  cachedClient = newWebSocketRpcSession(cachedEndpoint) as SyncedStateClient;
  return cachedClient;
};

export const getSyncedStateClient = (): SyncedStateClient => {
  if (cachedClient) {
    return cachedClient;
  }
  if (typeof window === "undefined") {
    throw new Error(
      "initSyncedStateClient must be called before using useSyncedState",
    );
  }
  cachedClient = newWebSocketRpcSession(cachedEndpoint) as SyncedStateClient;
  return cachedClient;
};

export const setSyncedStateClientForTesting = (
  client: SyncedStateClient | null,
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
) => {
  cachedClient = client;
  cachedEndpoint = endpoint;
};
