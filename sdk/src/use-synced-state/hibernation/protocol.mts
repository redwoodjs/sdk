export type SyncedStateValue = unknown;

// Version marker for the state-sync protocol. Bumped whenever the
// envelope or message shape changes incompatibly.
export const PROTOCOL_VERSION = 1;

// Every message on the wire is wrapped in a small envelope so the receiver can
// validate the protocol version and dispatch by kind. Body contents are
// type-specific.
export type SyncedStateEnvelope = {
  v: typeof PROTOCOL_VERSION;
} & SyncedStateMessage;

export type SyncedStateMessage = ClientMessage | ServerMessage;

// Messages sent by the client. `key` is always the user-facing key; the DO
// transforms it into a storage key internally when a key handler is registered.
export type ClientMessage =
  | { kind: "getState"; key: string; id: string }
  | { kind: "setState"; key: string; value: SyncedStateValue; id: string }
  | { kind: "subscribe"; key: string; id: string }
  | { kind: "unsubscribe"; key: string; id: string };

// Messages sent by the DO back to the client.
export type ServerMessage =
  | { kind: "getState"; key: string; value: SyncedStateValue | undefined; id: string }
  | { kind: "setState"; key: string; id: string }
  | { kind: "subscribe"; key: string; id: string }
  | { kind: "unsubscribe"; key: string; id: string }
  | { kind: "update"; key: string; value: SyncedStateValue }
  | { kind: "error"; message: string; id?: string };

export function packMessage(message: SyncedStateMessage): string {
  return JSON.stringify({ v: PROTOCOL_VERSION, ...message });
}

function parseEnvelope(data: string): SyncedStateEnvelope {
  const parsed = JSON.parse(data) as SyncedStateEnvelope;

  if (parsed.v !== PROTOCOL_VERSION) {
    throw new Error(
      `Unsupported protocol version: ${parsed.v ?? "missing"}`,
    );
  }

  return parsed;
}

function isClientMessage(message: SyncedStateMessage): message is ClientMessage {
  switch (message.kind) {
    case "getState":
    case "subscribe":
    case "unsubscribe":
      return "id" in message && typeof message.id === "string";
    case "setState":
      return "id" in message && typeof message.id === "string" && "value" in message;
    default:
      return false;
  }
}

function isServerMessage(message: SyncedStateMessage): message is ServerMessage {
  switch (message.kind) {
    case "getState":
      return "id" in message && typeof message.id === "string" && "value" in message;
    case "setState":
    case "subscribe":
    case "unsubscribe":
      return "id" in message && typeof message.id === "string";
    case "update":
      return "value" in message;
    case "error":
      return "message" in message && typeof message.message === "string";
    default:
      return false;
  }
}

export function unpackClientMessage(data: string): ClientMessage {
  const message = parseEnvelope(data);
  if (!isClientMessage(message)) {
    throw new Error("Invalid client message");
  }
  return message;
}

export function unpackServerMessage(data: string): ServerMessage {
  const message = parseEnvelope(data);
  if (!isServerMessage(message)) {
    throw new Error("Invalid server message");
  }
  return message;
}
