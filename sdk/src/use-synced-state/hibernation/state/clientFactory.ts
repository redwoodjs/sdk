import {
  type SyncedStateClient,
  type WebSocketFactory,
} from "../connection/types.js";
import { getConnection } from "../connection/connection.js";
import { sendMessage, makeMessageId } from "../connection/messages.js";
import { manager } from "./clientManager.js";

export function createSyncedStateClient(
  endpoint: string,
  webSocketFactory: WebSocketFactory,
): SyncedStateClient {
  const client: SyncedStateClient = {
    async getState(key: string): Promise<unknown> {
      const connection = getConnection(endpoint, webSocketFactory);
      return sendMessage(connection, {
        kind: "getState",
        key,
        id: makeMessageId(connection),
      });
    },

    async setState(value: unknown, key: string): Promise<void> {
      const connection = getConnection(endpoint, webSocketFactory);
      await sendMessage(connection, {
        kind: "setState",
        key,
        value,
        id: makeMessageId(connection),
      });
    },

    async subscribe(key: string, handler: (value: unknown) => void) {
      manager.addSubscription(key, handler, client);

      const connection = getConnection(endpoint, webSocketFactory);
      let handlers = connection.messageHandlers.get(key);
      if (!handlers) {
        handlers = new Set();
        connection.messageHandlers.set(key, handlers);
      }
      handlers.add(handler);

      if (connection.isOpen) {
        try {
          await sendMessage(connection, {
            kind: "subscribe",
            key,
            id: makeMessageId(connection),
          });
        } catch (error) {
          // Roll back local subscription state so we don't pretend to be
          // subscribed when the server rejected or never processed it.
          handlers.delete(handler);
          if (handlers.size === 0) connection.messageHandlers.delete(key);
          manager.removeSubscription(key, handler, client);
          throw error;
        }
      }
    },

    async unsubscribe(key: string, handler: (value: unknown) => void) {
      manager.removeSubscription(key, handler, client);

      const connection = manager.getConnection(endpoint);
      if (!connection) return;

      const handlers = connection.messageHandlers.get(key);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) connection.messageHandlers.delete(key);
      }

      try {
        if (connection.isOpen) {
          await sendMessage(connection, {
            kind: "unsubscribe",
            key,
            id: makeMessageId(connection),
          });
        }
      } catch {
        // Unsubscribe is often called during cleanup. Swallow errors from a
        // closing socket; the server attachment will be dropped anyway.
      }
    },
  };

  return client;
}
