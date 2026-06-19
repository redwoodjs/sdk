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
        connection.ws.send(
          JSON.stringify({
            v: 1,
            kind: "subscribe",
            key,
            id: makeMessageId(connection),
          }),
        );
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
      if (connection.isOpen) {
        connection.ws.send(
          JSON.stringify({
            v: 1,
            kind: "unsubscribe",
            key,
            id: makeMessageId(connection),
          }),
        );
      }
    },
  };

  return client;
}
