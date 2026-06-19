import {
  type ClientMessage,
  type ServerMessage,
  packMessage,
  unpackServerMessage,
} from "../protocol.mjs";
import { type Connection } from "./types.js";

export function makeMessageId(connection: Connection): string {
  return `${connection.nextId++}`;
}

export async function sendMessage(
  connection: Connection,
  message: ClientMessage,
): Promise<unknown> {
  const { isOpen, ws, pending } = connection;

  if (isOpen) {
    return new Promise((resolve, reject) => {
      pending.set(message.id, { resolve, reject });
      ws.send(packMessage(message));
    });
  }

  return new Promise((resolve, reject) => {
    const onOpen = () => {
      cleanup();
      connection.pending.set(message.id, { resolve, reject });
      connection.ws.send(packMessage(message));
    };
    const onClose = () => {
      cleanup();
      reject(new Error("WebSocket closed before message could be sent"));
    };
    const cleanup = () => {
      connection.ws.removeEventListener("open", onOpen);
      connection.ws.removeEventListener("close", onClose);
    };

    connection.ws.addEventListener("open", onOpen);
    connection.ws.addEventListener("close", onClose);
  });
}

export function handleServerMessage(
  connection: Connection,
  message: ServerMessage,
): void {
  if (message.kind === "update") {
    const handlers = connection.messageHandlers.get(message.key);
    if (handlers) for (const handler of handlers) handler(message.value);
    return;
  }

  if (message.kind === "error") {
    if (message.id !== undefined) {
      const pending = connection.pending.get(message.id);
      if (pending) {
        connection.pending.delete(message.id);
        pending.reject(new Error(message.message));
      }
    }
    return;
  }

  const pending = connection.pending.get(message.id);
  if (!pending) return;
  connection.pending.delete(message.id);
  pending.resolve(message.kind === "getState" ? message.value : undefined);
}

export function unpackMessage(data: unknown): ServerMessage | undefined {
  if (typeof data !== "string") return undefined;
  try {
    return unpackServerMessage(data);
  } catch {
    return undefined;
  }
}
