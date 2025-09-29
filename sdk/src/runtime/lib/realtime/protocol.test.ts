import { describe, expect, it } from "vitest";
import { Message, packMessage, unpackMessage } from "./protocol";
import { MESSAGE_TYPE } from "./shared";

describe("Realtime Protocol pack/unpack", () => {
  const textEncoder = new TextEncoder();

  // Helper to generate a UUID string of the correct length
  const generateId = () => "a".repeat(36);

  const testMessages: Message[] = [
    {
      type: MESSAGE_TYPE.ACTION_REQUEST,
      id: "my-action",
      args: { foo: "bar" },
      requestId: generateId(),
      clientUrl: "http://localhost:3000/",
    },
    {
      type: MESSAGE_TYPE.ACTION_START,
      id: generateId(),
      status: 200,
    },
    {
      type: MESSAGE_TYPE.ACTION_CHUNK,
      id: generateId(),
      payload: textEncoder.encode("chunk data"),
    },
    {
      type: MESSAGE_TYPE.ACTION_END,
      id: generateId(),
    },
    {
      type: MESSAGE_TYPE.ACTION_ERROR,
      id: generateId(),
      error: "Something went wrong",
    },
    {
      type: MESSAGE_TYPE.RSC_START,
      id: generateId(),
      status: 200,
    },
    {
      type: MESSAGE_TYPE.RSC_CHUNK,
      id: generateId(),
      payload: textEncoder.encode("rsc chunk"),
    },
    {
      type: MESSAGE_TYPE.RSC_END,
      id: generateId(),
    },
  ];

  testMessages.forEach((message) => {
    it(`should correctly pack and unpack a ${
      Object.keys(MESSAGE_TYPE).find(
        (key) =>
          MESSAGE_TYPE[key as keyof typeof MESSAGE_TYPE] === message.type,
      ) || "UNKNOWN"
    } message`, () => {
      const packed = packMessage(message);
      const unpacked = unpackMessage(packed);
      expect(unpacked).toEqual(message);
    });
  });

  describe("Error Handling", () => {
    it("should throw an error for an unknown message type on pack", () => {
      const invalidMessage = { type: 999 } as unknown as Message;
      expect(() => packMessage(invalidMessage)).toThrow(
        "Unknown message type for packing",
      );
    });

    it("should throw an error for an unknown message type on unpack", () => {
      const invalidData = new Uint8Array([99, 1, 2, 3]);
      expect(() => unpackMessage(invalidData)).toThrow(
        "Unknown message type for unpacking: 99",
      );
    });

    it("should throw an error for an empty message on unpack", () => {
      const emptyData = new Uint8Array([]);
      expect(() => unpackMessage(emptyData)).toThrow(
        "Cannot unpack empty message",
      );
    });

    const invalidLengthTests = [
      { type: MESSAGE_TYPE.ACTION_START, name: "START" },
      { type: MESSAGE_TYPE.RSC_START, name: "START" },
      { type: MESSAGE_TYPE.ACTION_CHUNK, name: "CHUNK" },
      { type: MESSAGE_TYPE.RSC_CHUNK, name: "CHUNK" },
      { type: MESSAGE_TYPE.ACTION_END, name: "END" },
      { type: MESSAGE_TYPE.RSC_END, name: "END" },
      { type: MESSAGE_TYPE.ACTION_ERROR, name: "ERROR" },
    ];

    invalidLengthTests.forEach(({ type, name }) => {
      it(`should throw for invalid ${name} message length on unpack`, () => {
        const invalidData = new Uint8Array([type, 1, 2, 3]); // Too short
        expect(() => unpackMessage(invalidData)).toThrow(
          `Invalid ${name} message length`,
        );
      });
    });

    const invalidIdTests = [
      { type: MESSAGE_TYPE.ACTION_START, name: "START" },
      { type: MESSAGE_TYPE.RSC_START, name: "START" },
      { type: MESSAGE_TYPE.ACTION_CHUNK, name: "CHUNK" },
      { type: MESSAGE_TYPE.RSC_CHUNK, name: "CHUNK" },
      { type: MESSAGE_TYPE.ACTION_END, name: "END" },
      { type: MESSAGE_TYPE.RSC_END, name: "END" },
      { type: MESSAGE_TYPE.ACTION_ERROR, name: "ERROR" },
    ];

    invalidIdTests.forEach(({ type, name }) => {
      it(`should throw for invalid ID length on ${name} message pack`, () => {
        const message = {
          type,
          id: "short-id",
          status: 200, // For START types
          payload: new Uint8Array(), // For CHUNK types
          error: "", // For ERROR type
        } as Message;
        expect(() => packMessage(message)).toThrow(
          `Invalid message ID length for ${name} message`,
        );
      });
    });
  });
});
