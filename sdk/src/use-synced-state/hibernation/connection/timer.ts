import { type Connection } from "./types.js";

// context(justinvdm, 29 Jun 2026): This timeout applies only to requests that
// are waiting for a server response, not to idle connections. Hibernation
// relies on idle sockets being allowed to sleep, so we must not close a socket
// just because no traffic has arrived.
export const PENDING_REQUEST_TIMEOUT_MS = 30_000;

export function startPendingRequestTimer(connection: Connection): void {
  stopPendingRequestTimer(connection);
  if (connection.pending.size === 0) {
    return;
  }
  connection.pendingRequestTimer = setTimeout(() => {
    rejectPending(connection, "useSyncedState request timed out");
    try {
      connection.ws.close();
    } catch {
      // Close event will drive reconnect if needed.
    }
  }, PENDING_REQUEST_TIMEOUT_MS);
}

export function stopPendingRequestTimer(connection: Connection): void {
  if (connection.pendingRequestTimer) {
    clearTimeout(connection.pendingRequestTimer);
    connection.pendingRequestTimer = null;
  }
}

export function rejectPending(connection: Connection, reason: string): void {
  for (const pending of connection.pending.values()) {
    pending.reject(new Error(reason));
  }
  connection.pending.clear();
  stopPendingRequestTimer(connection);
}
