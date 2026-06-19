import {
  type SyncedStateClient,
  type SyncedStateStatus,
  type StatusChangeCallback,
  type Connection,
} from "../connection/types.js";

type Subscription = {
  key: string;
  handler: (value: unknown) => void;
  client: SyncedStateClient;
};

type BackoffState = {
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
};

/**
 * Owns all cross-request state for the hibernation sync-state client:
 * cached clients, open connections, active subscriptions, status listeners,
 * and per-endpoint reconnection backoff.
 *
 * A single module-level instance is used because the client cache and
 * subscription registry must survive across React renders and component
 * unmount/mount cycles on the same page.
 */
export class SyncedStateClientManager {
  clients = new Map<string, SyncedStateClient>();
  connections = new Map<string, Connection>();
  subscriptions = new Set<Subscription>();
  statusListeners = new Map<string, StatusChangeCallback[]>();
  backoff = new Map<string, BackoffState>();

  normalizeEndpoint(endpoint: string): string {
    if (endpoint.startsWith("/") && typeof window !== "undefined") {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${window.location.host}${endpoint}`;
    }
    return endpoint;
  }

  // -------------------------------------------------------------------------
  // Clients
  // -------------------------------------------------------------------------

  getClient(endpoint: string): SyncedStateClient | undefined {
    return this.clients.get(endpoint);
  }

  setClient(endpoint: string, client: SyncedStateClient): void {
    this.clients.set(endpoint, client);
  }

  deleteClient(endpoint: string): void {
    this.clients.delete(endpoint);
  }

  // -------------------------------------------------------------------------
  // Connections
  // -------------------------------------------------------------------------

  getConnection(endpoint: string): Connection | undefined {
    return this.connections.get(endpoint);
  }

  setConnection(endpoint: string, connection: Connection): void {
    this.connections.set(endpoint, connection);
  }

  deleteConnection(endpoint: string): void {
    this.connections.delete(endpoint);
  }

  // -------------------------------------------------------------------------
  // Backoff
  // -------------------------------------------------------------------------

  getBackoff(endpoint: string): BackoffState {
    return this.backoff.get(endpoint) ?? { attempt: 0, timer: null };
  }

  setBackoff(endpoint: string, state: BackoffState): void {
    this.backoff.set(endpoint, state);
  }

  resetBackoff(endpoint: string): void {
    const state = this.getBackoff(endpoint);
    if (state.timer !== null) {
      clearTimeout(state.timer);
    }
    this.backoff.set(endpoint, { attempt: 0, timer: null });
  }

  // -------------------------------------------------------------------------
  // Status listeners
  // -------------------------------------------------------------------------

  notifyStatusChange = (endpoint: string, status: SyncedStateStatus): void => {
    const listeners = this.statusListeners.get(endpoint);
    if (!listeners) return;
    for (const cb of [...listeners]) cb(status);
  };

  onStatusChange = (
    endpoint: string,
    callback: StatusChangeCallback,
  ): (() => void) => {
    const normalized = this.normalizeEndpoint(endpoint);
    let listeners = this.statusListeners.get(normalized);
    if (!listeners) {
      listeners = [];
      this.statusListeners.set(normalized, listeners);
    }
    listeners.push(callback);
    return () => {
      const idx = listeners!.indexOf(callback);
      if (idx !== -1) listeners!.splice(idx, 1);
      if (listeners!.length === 0) this.statusListeners.delete(normalized);
    };
  };

  // -------------------------------------------------------------------------
  // Subscriptions
  // -------------------------------------------------------------------------

  addSubscription(
    key: string,
    handler: (value: unknown) => void,
    client: SyncedStateClient,
  ): void {
    const exists = [...this.subscriptions].some(
      (s) => s.key === key && s.handler === handler && s.client === client,
    );
    if (!exists) this.subscriptions.add({ key, handler, client });
  }

  removeSubscription(
    key: string,
    handler: (value: unknown) => void,
    client: SyncedStateClient,
  ): void {
    for (const sub of [...this.subscriptions]) {
      if (sub.key === key && sub.handler === handler && sub.client === client) {
        this.subscriptions.delete(sub);
      }
    }
  }

  subscriptionsForClient(client: SyncedStateClient): Subscription[] {
    return [...this.subscriptions].filter((s) => s.client === client);
  }

  clearSubscriptions(): void {
    this.subscriptions.clear();
  }

  // -------------------------------------------------------------------------
  // Global reset (used by tests and beforeunload)
  // -------------------------------------------------------------------------

  clearForTesting(endpoint: string): void {
    const normalized = this.normalizeEndpoint(endpoint);

    const connection = this.getConnection(normalized);
    if (connection) {
      if (connection.deadConnectionTimer) {
        clearTimeout(connection.deadConnectionTimer);
        connection.deadConnectionTimer = null;
      }
      try {
        connection.ws.close();
      } catch {}
      this.deleteConnection(normalized);
    }

    for (const state of this.backoff.values()) {
      if (state.timer !== null) clearTimeout(state.timer);
    }

    this.clients.delete(normalized);
    this.backoff.clear();
    this.statusListeners.clear();
    this.subscriptions.clear();
  }

  beforeUnload = (): void => {
    if (this.subscriptions.size === 0) return;
    const subscriptions = Array.from(this.subscriptions);
    this.subscriptions.clear();
    for (const { key, handler, client } of subscriptions) {
      void client.unsubscribe(key, handler).catch(() => {});
    }
  };
}

export const manager = new SyncedStateClientManager();

if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", manager.beforeUnload);
}
