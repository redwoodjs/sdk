import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {
    protected ctx: any;
    protected env: any;
    constructor(ctx: any, env: any) {
      this.ctx = ctx;
      this.env = env;
    }
  }
  return { DurableObject };
});

import { SyncedStateServer } from "../server.mjs";
import { packMessage } from "../protocol.mjs";

// Minimal in-memory storage stub for the DO tests.
function createStorageStub(store = new Map<string, unknown>()) {
  return {
    async list<T>(options?: { prefix?: string }) {
      const prefix = options?.prefix ?? "";
      const entries = new Map<string, T>();
      for (const [key, value] of store) {
        if (key.startsWith(prefix)) {
          entries.set(key, value as T);
        }
      }
      return entries;
    },
    async put(key: string, value: unknown) {
      store.set(key, value);
    },
    async get<T>(key: string) {
      return store.get(key) as T | undefined;
    },
    async delete(key: string) {
      store.delete(key);
    },
    _store: store,
  };
}

// Minimal DurableObjectState stub that tracks accepted WebSockets.
function createStateStub(store?: Map<string, unknown>) {
  const sockets: WebSocket[] = [];
  return {
    storage: createStorageStub(store),
    getWebSockets() {
      return sockets;
    },
    acceptWebSocket(ws: WebSocket) {
      sockets.push(ws);
    },
    id: { toString: () => "test-do-id" } as unknown as DurableObjectId,
    _sockets: sockets,
  };
}

type StateStub = ReturnType<typeof createStateStub>;

// Minimal WebSocket stub that supports the methods we use.
function createWebSocketStub(identity?: unknown): WebSocket {
  const sent: unknown[] = [];
  const ws = {
    attachment: {
      clientId: "test-client",
      identity,
      subscriptions: [],
    } as unknown,
    send(data: unknown) {
      sent.push(data);
    },
    addEventListener(_event: string, _handler: Function) {
      // not used in DO tests
    },
    serializeAttachment(value: unknown) {
      this.attachment = value;
    },
    deserializeAttachment() {
      return this.attachment;
    },
    close() {},
    _sent: sent,
  };
  return ws as unknown as WebSocket;
}

// Helper to simulate an upgrade request arriving at the DO with an identity.
function createUpgradeRequest(identity: unknown): Request {
  const url = new URL("https://example.com/__synced-state");
  if (identity !== undefined) {
    url.searchParams.set("__ssi", JSON.stringify(identity));
  }
  url.searchParams.set("clientId", "test-client");
  return new Request(url.toString(), {
    headers: { Upgrade: "websocket" },
  });
}

function createServer(store?: Map<string, unknown>) {
  const state = createStateStub(store);
  const server = new SyncedStateServer(state as any, {} as any);
  return { server, state };
}

describe("SyncedStateServer", () => {
  afterEach(() => {
    SyncedStateServer.registerKeyHandler(null);
    SyncedStateServer.registerRoomHandler(null);
    SyncedStateServer.registerSetStateHandler(null);
    SyncedStateServer.registerGetStateHandler(null);
    SyncedStateServer.registerSubscribeHandler(null);
    SyncedStateServer.registerUnsubscribeHandler(null);
    SyncedStateServer.registerIdentityExtractor(null);
  });

  it("stores and retrieves state by key", async () => {
    const { server } = createServer();
    const ws = createWebSocketStub();

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 5, id: "1" }),
    );
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    expect((ws as any)._sent).toHaveLength(2);
    const response = JSON.parse((ws as any)._sent[1] as string);
    expect(response).toMatchObject({
      v: 1,
      kind: "getState",
      key: "counter",
      value: 5,
      id: "2",
    });
  });

  it("notifies subscribers when state changes", async () => {
    const { server, state } = createServer();
    const ws = createWebSocketStub();
    state.acceptWebSocket(ws);

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 7, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toContainEqual({
      v: 1,
      kind: "update",
      key: "counter",
      value: 7,
    });
  });

  it("transforms keys using the registered key handler and captured identity", async () => {
    const { server } = createServer();

    SyncedStateServer.registerKeyHandler(
      async (key, identity) => `user:${(identity as any).userId}:${key}`,
    );

    const ws = createWebSocketStub({ userId: "123" });

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 9, id: "1" }),
    );
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    const getStateResponse = JSON.parse((ws as any)._sent[1] as string);
    expect(getStateResponse.value).toBe(9);

    // A different user key should be isolated.
    const ws2 = createWebSocketStub({ userId: "456" });
    await server.webSocketMessage(
      ws2 as any,
      packMessage({ kind: "getState", key: "counter", id: "3" }),
    );

    const otherResponse = JSON.parse((ws2 as any)._sent[0] as string);
    expect(otherResponse.value).toBeUndefined();
  });

  it("invokes registered setState handler with identity", async () => {
    const { server } = createServer();
    server.setStub({} as any);
    const calls: Array<{ key: string; value: unknown; identity: unknown }> = [];
    SyncedStateServer.registerSetStateHandler((key, value, identity) => {
      calls.push({ key, value, identity });
    });
    const ws = createWebSocketStub({ userId: "42" });

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "x", value: 1, id: "1" }),
    );

    expect(calls).toEqual([
      { key: "x", value: 1, identity: { userId: "42" } },
    ]);
  });

  it("broadcasts public RPC setState to sockets subscribed only via attachments", async () => {
    const { server, state } = createServer();
    const ws = createWebSocketStub();
    // Simulate a socket that survived hibernation with a persisted subscription.
    ws.serializeAttachment({
      clientId: "test-client",
      identity: undefined,
      subscriptions: [{ userKey: "counter", storageKey: "counter" }],
    });
    state.acceptWebSocket(ws);

    // Use the public RPC surface, as a background Worker would.
    await server.setState("rpc value", "counter");

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toContainEqual({
      v: 1,
      kind: "update",
      key: "counter",
      value: "rpc value",
    });
  });

  it("broadcasts client setState after hibernation to all subscribed sockets", async () => {
    const store = new Map<string, unknown>();
    const { server: firstServer, state } = createServer(store);

    const ws1 = createWebSocketStub();
    const ws2 = createWebSocketStub();
    state.acceptWebSocket(ws1);
    state.acceptWebSocket(ws2);

    await firstServer.webSocketMessage(
      ws1 as any,
      packMessage({ kind: "subscribe", key: "counter", id: "s1" }),
    );
    await firstServer.webSocketMessage(
      ws2 as any,
      packMessage({ kind: "subscribe", key: "counter", id: "s2" }),
    );

    // Simulate DO eviction by creating a fresh server with the same storage
    // and sockets that already carry subscription attachments.
    const { server: secondServer, state: secondState } = createServer(store);
    secondState.acceptWebSocket(ws1);
    secondState.acceptWebSocket(ws2);

    await secondServer.webSocketMessage(
      ws1 as any,
      packMessage({ kind: "setState", key: "counter", value: 42, id: "3" }),
    );

    for (const socket of [ws1, ws2]) {
      const messages = (socket as any)._sent.map((m: unknown) =>
        JSON.parse(m as string),
      );
      expect(messages).toContainEqual({
        v: 1,
        kind: "update",
        key: "counter",
        value: 42,
      });
    }
  });

  it("broadcasts transformed keys back to each socket's user-facing key", async () => {
    const { server, state } = createServer();

    SyncedStateServer.registerKeyHandler(
      async (key, identity) => `user:${(identity as any).userId}:${key}`,
    );

    const ws = createWebSocketStub({ userId: "123" });
    state.acceptWebSocket(ws);

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );

    // Public RPC uses the storage key directly.
    await server.setState("transformed value", "user:123:counter");

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toContainEqual({
      v: 1,
      kind: "update",
      key: "counter",
      value: "transformed value",
    });
  });

  it("stops broadcasting to a socket after it unsubscribes", async () => {
    const { server, state } = createServer();
    const ws = createWebSocketStub();
    state.acceptWebSocket(ws);

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "unsubscribe", key: "counter", id: "2" }),
    );
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 99, id: "3" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).not.toContainEqual(
      expect.objectContaining({ kind: "update" }),
    );
  });

  it("skips sockets with malformed attachments without breaking delivery", async () => {
    const { server, state } = createServer();
    const badWs = createWebSocketStub();
    const goodWs = createWebSocketStub();

    badWs.serializeAttachment({ malformed: true });
    goodWs.serializeAttachment({
      clientId: "good",
      identity: undefined,
      subscriptions: [{ userKey: "counter", storageKey: "counter" }],
    });

    state.acceptWebSocket(badWs);
    state.acceptWebSocket(goodWs);

    await server.setState("value", "counter");

    const goodMessages = (goodWs as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(goodMessages).toContainEqual({
      v: 1,
      kind: "update",
      key: "counter",
      value: "value",
    });

    expect((badWs as any)._sent).toHaveLength(0);
  });

  it("rejects unsupported protocol versions", async () => {
    const { server } = createServer();
    const ws = createWebSocketStub();

    await server.webSocketMessage(
      ws as any,
      JSON.stringify({ v: 99, kind: "getState", key: "counter", id: "1" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ v: 1, kind: "error" });
    expect(messages[0].message).toContain("Unsupported protocol version");
  });

  it("persists state across DO evictions", async () => {
    const store = new Map<string, unknown>();
    const { server: firstServer } = createServer(store);
    const ws = createWebSocketStub();

    await firstServer.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 99, id: "1" }),
    );

    // Simulate a fresh DO instance reading from the same storage.
    const { server: secondServer } = createServer(store);
    const ws2 = createWebSocketStub();
    await secondServer.webSocketMessage(
      ws2 as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    const response = JSON.parse((ws2 as any)._sent[0] as string);
    expect(response).toMatchObject({
      v: 1,
      kind: "getState",
      key: "counter",
      value: 99,
      id: "2",
    });
  });

  it("deduplicates subscriptions from the same socket for the same key", async () => {
    const { server, state } = createServer();
    const ws = createWebSocketStub();
    state.acceptWebSocket(ws);

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "2" }),
    );

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 7, id: "3" }),
    );

    const updateMessages = (ws as any)._sent
      .map((m: unknown) => JSON.parse(m as string))
      .filter((m: any) => m.kind === "update");
    expect(updateMessages).toHaveLength(1);
    expect(updateMessages[0]).toMatchObject({
      v: 1,
      kind: "update",
      key: "counter",
      value: 7,
    });
  });

  it("sends an error response when a key handler throws", async () => {
    const { server } = createServer();
    SyncedStateServer.registerKeyHandler(async () => {
      throw new Error("key handler failed");
    });

    const ws = createWebSocketStub();
    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "req-1" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      v: 1,
      kind: "error",
      id: "req-1",
      message: "key handler failed",
    });
  });

  it("sends an error response when storage fails during setState", async () => {
    const state = {
      storage: {
        async list() {
          return new Map();
        },
        async put() {
          throw new Error("storage down");
        },
      },
      getWebSockets() {
        return [];
      },
      acceptWebSocket() {},
      id: { toString: () => "test-do-id" },
    };
    const server = new SyncedStateServer(state as any, {} as any);
    const ws = createWebSocketStub();

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 1, id: "req-2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      v: 1,
      kind: "error",
      id: "req-2",
      message: "storage down",
    });
  });

  it("sends an error response for messages that fail protocol validation", async () => {
    const { server } = createServer();
    const ws = createWebSocketStub();

    await server.webSocketMessage(
      ws as any,
      packMessage({ kind: "unknown" as any, key: "counter", id: "req-3" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) =>
      JSON.parse(m as string),
    );
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      v: 1,
      kind: "error",
      message: "Invalid client message",
    });
  });
});
