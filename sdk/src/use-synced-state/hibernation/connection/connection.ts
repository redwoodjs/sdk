import { manager } from "../state/clientManager.js";
import { reconnect } from "../reconnect/reconnect.js";
import { sendMessage, makeMessageId, unpackMessage, handleServerMessage } from "./messages.js";
import { rejectPending } from "./timer.js";
import { type Connection, type WebSocketFactory } from "./types.js";

export function getConnection(
  endpoint: string,
  webSocketFactory: WebSocketFactory,
): Connection {
  let connection = manager.getConnection(endpoint);
  if (!connection) {
    connection = createConnection(endpoint, webSocketFactory);
    manager.setConnection(endpoint, connection);
  }
  return connection;
}

function createConnection(
  endpoint: string,
  webSocketFactory: WebSocketFactory,
): Connection {
  const connection: Connection = {
    ws: webSocketFactory(endpoint),
    nextId: 0,
    pending: new Map(),
    isOpen: false,
    messageHandlers: new Map(),
    deadConnectionTimer: null,
    webSocketFactory,
  };

  connection.ws.addEventListener("open", () => {
    connection.isOpen = true;
    manager.notifyStatusChange(endpoint, "connected");
    manager.resetBackoff(endpoint);
    resubscribeAndSync(connection, endpoint);
  });

  connection.ws.addEventListener("message", (event) => {
    const message = unpackMessage(event.data);
    if (!message) return;

    handleServerMessage(connection, message);
  });

  connection.ws.addEventListener("close", () => {
    connection.isOpen = false;
    rejectPending(connection, "WebSocket closed");

    if (manager.getConnection(endpoint) === connection) {
      manager.deleteConnection(endpoint);
      reconnect(endpoint);
    }
  });

  connection.ws.addEventListener("error", () => {
    // Close event will fire next and drive reconnection.
  });

  return connection;
}

function resubscribeAndSync(connection: Connection, endpoint: string): void {
  const client = manager.getClient(endpoint);
  if (!client) return;

  for (const sub of manager.subscriptionsForClient(client)) {
    void sendMessage(connection, {
      kind: "subscribe",
      key: sub.key,
      id: makeMessageId(connection),
    }).catch(() => {});

    void sendMessage(connection, {
      kind: "getState",
      key: sub.key,
      id: makeMessageId(connection),
    })
      .then((value) => {
        if (value !== undefined) sub.handler(value);
      })
      .catch(() => {});
  }
}
