import { MESSAGE_TYPE } from "./shared";

const TEXT_ENCODER = new TextEncoder();
const TEXT_DECODER = new TextDecoder();
const ID_LENGTH = 36; // Length of a UUID string

// Discriminated union of all possible messages
export type Message =
  | ActionRequestMessage
  | ActionStartMessage
  | ActionChunkMessage
  | ActionEndMessage
  | ActionErrorMessage
  | RscStartMessage
  | RscChunkMessage
  | RscEndMessage;

export type ActionRequestMessage = {
  type: typeof MESSAGE_TYPE.ACTION_REQUEST;
  id: string | null;
  args: any;
  requestId: string;
  clientUrl: string;
};

export type ActionStartMessage = {
  type: typeof MESSAGE_TYPE.ACTION_START;
  id: string; // request id
  status: number;
};

export type ActionChunkMessage = {
  type: typeof MESSAGE_TYPE.ACTION_CHUNK;
  id: string; // request id
  payload: Uint8Array;
};

export type ActionEndMessage = {
  type: typeof MESSAGE_TYPE.ACTION_END;
  id: string; // request id
};

export type ActionErrorMessage = {
  type: typeof MESSAGE_TYPE.ACTION_ERROR;
  id: string; // request id
  error: string;
};

export type RscStartMessage = {
  type: typeof MESSAGE_TYPE.RSC_START;
  id: string; // rsc id
  status: number;
};

export type RscChunkMessage = {
  type: typeof MESSAGE_TYPE.RSC_CHUNK;
  id: string; // rsc id
  payload: Uint8Array;
};

export type RscEndMessage = {
  type: typeof MESSAGE_TYPE.RSC_END;
  id: string; // rsc id
};

/**
 * Packs a message object into a Uint8Array for sending over WebSocket.
 */
export function packMessage(message: Message): Uint8Array {
  switch (message.type) {
    case MESSAGE_TYPE.ACTION_REQUEST: {
      const msg = message as ActionRequestMessage;
      const jsonPayload = JSON.stringify({
        id: msg.id,
        args: msg.args,
        requestId: msg.requestId,
        clientUrl: msg.clientUrl,
      });
      const payloadBytes = TEXT_ENCODER.encode(jsonPayload);
      const packed = new Uint8Array(1 + payloadBytes.length);
      packed[0] = msg.type;
      packed.set(payloadBytes, 1);
      return packed;
    }

    case MESSAGE_TYPE.ACTION_START:
    case MESSAGE_TYPE.RSC_START: {
      const msg = message as ActionStartMessage | RscStartMessage;
      const idBytes = TEXT_ENCODER.encode(msg.id);
      if (idBytes.length !== ID_LENGTH) {
        throw new Error("Invalid message ID length for START message");
      }
      const packed = new Uint8Array(2 + ID_LENGTH);
      packed[0] = msg.type;
      packed[1] = msg.status;
      packed.set(idBytes, 2);
      return packed;
    }

    case MESSAGE_TYPE.ACTION_CHUNK:
    case MESSAGE_TYPE.RSC_CHUNK: {
      const msg = message as ActionChunkMessage | RscChunkMessage;
      const idBytes = TEXT_ENCODER.encode(msg.id);
      if (idBytes.length !== ID_LENGTH) {
        throw new Error("Invalid message ID length for CHUNK message");
      }
      const packed = new Uint8Array(1 + ID_LENGTH + msg.payload.length);
      packed[0] = msg.type;
      packed.set(idBytes, 1);
      packed.set(msg.payload, 1 + ID_LENGTH);
      return packed;
    }

    case MESSAGE_TYPE.ACTION_END:
    case MESSAGE_TYPE.RSC_END: {
      const msg = message as ActionEndMessage | RscEndMessage;
      const idBytes = TEXT_ENCODER.encode(msg.id);
      if (idBytes.length !== ID_LENGTH) {
        throw new Error("Invalid message ID length for END message");
      }
      const packed = new Uint8Array(1 + ID_LENGTH);
      packed[0] = msg.type;
      packed.set(idBytes, 1);
      return packed;
    }

    case MESSAGE_TYPE.ACTION_ERROR: {
      const msg = message as ActionErrorMessage;
      const idBytes = TEXT_ENCODER.encode(msg.id);
      if (idBytes.length !== ID_LENGTH) {
        throw new Error("Invalid message ID length for ERROR message");
      }
      const errorPayload = JSON.stringify({ error: msg.error });
      const errorBytes = TEXT_ENCODER.encode(errorPayload);
      const packed = new Uint8Array(1 + ID_LENGTH + errorBytes.length);
      packed[0] = msg.type;
      packed.set(idBytes, 1);
      packed.set(errorBytes, 1 + ID_LENGTH);
      return packed;
    }

    default:
      // This should be unreachable if all message types are handled
      throw new Error(`Unknown message type for packing`);
  }
}

/**
 * Unpacks a Uint8Array from WebSocket into a message object.
 */
export function unpackMessage(data: Uint8Array): Message {
  if (data.length === 0) {
    throw new Error("Cannot unpack empty message");
  }

  const messageType = data[0];

  switch (messageType) {
    case MESSAGE_TYPE.ACTION_REQUEST: {
      const jsonPayload = TEXT_DECODER.decode(data.slice(1));
      const parsed = JSON.parse(jsonPayload);
      return { type: messageType, ...parsed };
    }

    case MESSAGE_TYPE.ACTION_START:
    case MESSAGE_TYPE.RSC_START: {
      if (data.length !== 2 + ID_LENGTH) {
        throw new Error("Invalid START message length");
      }
      const id = TEXT_DECODER.decode(data.slice(2, 2 + ID_LENGTH));
      const status = data[1];
      return { type: messageType, id, status };
    }

    case MESSAGE_TYPE.ACTION_CHUNK:
    case MESSAGE_TYPE.RSC_CHUNK: {
      if (data.length < 1 + ID_LENGTH) {
        throw new Error("Invalid CHUNK message length");
      }
      const id = TEXT_DECODER.decode(data.slice(1, 1 + ID_LENGTH));
      const payload = data.slice(1 + ID_LENGTH);
      return { type: messageType, id, payload };
    }

    case MESSAGE_TYPE.ACTION_END:
    case MESSAGE_TYPE.RSC_END: {
      if (data.length !== 1 + ID_LENGTH) {
        throw new Error("Invalid END message length");
      }
      const id = TEXT_DECODER.decode(data.slice(1, 1 + ID_LENGTH));
      return { type: messageType, id };
    }

    case MESSAGE_TYPE.ACTION_ERROR: {
      if (data.length < 1 + ID_LENGTH) {
        throw new Error("Invalid ERROR message length");
      }
      const id = TEXT_DECODER.decode(data.slice(1, 1 + ID_LENGTH));
      const errorPayload = TEXT_DECODER.decode(data.slice(1 + ID_LENGTH));
      let error = "Unknown error";
      try {
        error = JSON.parse(errorPayload).error;
      } catch (e) {
        // ignore if it's not a json
      }
      return { type: messageType, id, error };
    }

    default:
      throw new Error(`Unknown message type for unpacking: ${messageType}`);
  }
}
