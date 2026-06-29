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
    // We intentionally do not close the socket here. In Cloudflare's
    // environment a half-open WebSocket is unlikely; the server should
    // already have sent an error frame for any throw (see server.mts).
    // Closing would trigger a visible reconnect that looks like the old
    // idle-timeout symptom. We only reject the pending promises so the
    // caller is not left hanging forever.
    rejectPending(connection, "useSyncedState request timed out");
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
