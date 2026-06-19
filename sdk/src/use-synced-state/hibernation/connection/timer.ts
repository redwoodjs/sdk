import { manager } from "../state/clientManager.js";
import { reconnect } from "../reconnect/reconnect.js";
import { type Connection } from "./types.js";

export const DEAD_CONNECTION_TIMEOUT_MS = 90_000;

export function cleanupConnectionTimers(connection: Connection): void {
  if (connection.deadConnectionTimer) {
    clearTimeout(connection.deadConnectionTimer);
    connection.deadConnectionTimer = null;
  }
}

export function rejectPending(connection: Connection, reason: string): void {
  for (const pending of connection.pending.values()) {
    pending.reject(new Error(reason));
  }
  connection.pending.clear();
}

export function resetDeadConnectionTimer(
  connection: Connection,
  endpoint: string,
): void {
  if (connection.deadConnectionTimer) {
    clearTimeout(connection.deadConnectionTimer);
  }
  connection.deadConnectionTimer = setTimeout(() => {
    try {
      connection.ws.close();
    } catch {}
    connection.isOpen = false;
    rejectPending(connection, "WebSocket timed out");
    cleanupConnectionTimers(connection);
    if (manager.getConnection(endpoint) === connection) {
      manager.deleteConnection(endpoint);
      reconnect(endpoint);
    }
  }, DEAD_CONNECTION_TIMEOUT_MS);
}
