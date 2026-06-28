import { type Connection } from "./types.js";

export const DEAD_CONNECTION_TIMEOUT_MS = 90_000;

export function stopDeadConnectionTimer(connection: Connection): void {
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
  stopDeadConnectionTimer(connection);
}
