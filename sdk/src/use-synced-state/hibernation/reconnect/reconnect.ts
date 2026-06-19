import { manager } from "../state/clientManager.js";
import { getConnection } from "../connection/connection.js";
import { getBackoffMs } from "./backoff.js";

/**
 * Schedules a reconnect for the given endpoint using exponential backoff.
 *
 * When the timer fires, the old connection (if any) is closed and evicted,
 * and a fresh connection is created. The new connection's `open` handler will
 * re-subscribe to all active keys and re-fetch their state.
 */
export function reconnect(endpoint: string): void {
  const state = manager.getBackoff(endpoint);
  if (state.timer !== null) return;

  manager.notifyStatusChange(endpoint, "disconnected");

  const delayMs = getBackoffMs(state.attempt);
  state.timer = setTimeout(() => {
    state.timer = null;
    state.attempt++;
    manager.setBackoff(endpoint, state);
    manager.notifyStatusChange(endpoint, "reconnecting");

    const deadConnection = manager.getConnection(endpoint);
    if (deadConnection) {
      try {
        deadConnection.ws.close();
      } catch {}
      manager.deleteConnection(endpoint);
    }

    const factory =
      deadConnection?.webSocketFactory ?? ((url) => new WebSocket(url));
    getConnection(endpoint, factory);
  }, delayMs);

  manager.setBackoff(endpoint, state);
}
