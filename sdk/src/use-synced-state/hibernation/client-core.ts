import { DEFAULT_SYNCED_STATE_PATH } from "../constants.mjs";
import {
  type SyncedStateClient,
  type SyncedStateStatus,
  type StatusChangeCallback,
  type WebSocketFactory,
} from "./connection/types.js";
import { manager } from "./state/clientManager.js";
import { createSyncedStateClient } from "./state/clientFactory.js";
import { getBackoffMs } from "./reconnect/backoff.js";
import { DEAD_CONNECTION_TIMEOUT_MS } from "./connection/timer.js";

export type { SyncedStateClient, SyncedStateStatus, StatusChangeCallback };

export const onStatusChange = manager.onStatusChange;

/**
 * Returns a cached client for the provided endpoint, creating it when necessary.
 * The returned client is a thin wrapper around a raw WebSocket that speaks the
 * JSON state-sync protocol.
 */
export const getSyncedStateClient = (
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
  webSocketFactory: WebSocketFactory = (url) => new WebSocket(url),
): SyncedStateClient => {
  const normalized = manager.normalizeEndpoint(endpoint);

  const existingClient = manager.getClient(normalized);
  if (existingClient) return existingClient;

  const client = createSyncedStateClient(normalized, webSocketFactory);
  manager.setClient(normalized, client);
  return client;
};

/**
 * Resets all state for an endpoint. Used by tests to isolate test cases and
 * by cleanup paths.
 */
export const setSyncedStateClientForTesting = (
  client: SyncedStateClient | null,
  endpoint: string = DEFAULT_SYNCED_STATE_PATH,
) => {
  const normalized = manager.normalizeEndpoint(endpoint);
  if (client) {
    manager.setClient(normalized, client);
  } else {
    manager.clearForTesting(normalized);
  }
};

// Exported for testing only
export const __testing = {
  getBackoffMs,
  DEAD_CONNECTION_TIMEOUT_MS,
};
