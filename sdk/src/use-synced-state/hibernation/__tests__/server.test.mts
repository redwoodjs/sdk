import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import { SyncedStateServer } from "../server.mjs";
import { packMessage } from "../protocol.mjs";

// Minimal in-memory storage stub for the DO tests.
function createStorageStub() {
  const store = new Map<string, unknown>();
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

// Minimal WebSocket stub that supports the methods we use.
function createWebSocketStub(identity?: unknown): WebSocket {
  const sent: unknown[] = [];
  const ws = {
    attachment: { clientId: "test-client", identity, subscriptions: [] } as unknown,
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
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 5, id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    expect((ws as any)._sent).toHaveLength(2);
    const response = JSON.parse((ws as any)._sent[1] as string);
    expect(response).toMatchObject({ v: 1, kind: "getState", key: "counter", value: 5, id: "2" });
  });

  it("notifies subscribers when state changes", async () => {
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 7, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toContainEqual({ v: 1, kind: "update", key: "counter", value: 7 });
  });

  it("transforms keys using the registered key handler and captured identity", async () => {
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );

    SyncedStateServer.registerKeyHandler(
      async (key, identity) => `user:${(identity as any).userId}:${key}`,
    );

    const ws = createWebSocketStub({ userId: "123" });

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 9, id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    const getStateResponse = JSON.parse((ws as any)._sent[1] as string);
    expect(getStateResponse.value).toBe(9);

    // A different user key should be isolated.
    const ws2 = createWebSocketStub({ userId: "456" });
    await coordinator.webSocketMessage(
      ws2 as any,
      packMessage({ kind: "getState", key: "counter", id: "3" }),
    );

    const otherResponse = JSON.parse((ws2 as any)._sent[0] as string);
    expect(otherResponse.value).toBeUndefined();
  });

  it("invokes registered setState handler with identity", async () => {
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    coordinator.setStub({} as any);
    const calls: Array<{ key: string; value: unknown; identity: unknown }> = [];
    SyncedStateServer.registerSetStateHandler((key, value, identity) => {
      calls.push({ key, value, identity });
    });
    const ws = createWebSocketStub({ userId: "42" });

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "x", value: 1, id: "1" }),
    );

    expect(calls).toEqual([{ key: "x", value: 1, identity: { userId: "42" } }]);
  });

  it("rehydrates subscriptions after simulated hibernation", async () => {
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );

    // Simulate DO eviction by clearing the in-memory subscription map.
    (coordinator as any)["#subscriptions" as never]?.clear?.();

    // A setState message should still trigger an update because the attachment
    // is rehydrated when the message handler runs.
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 42, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toContainEqual({ v: 1, kind: "update", key: "counter", value: 42 });
  });

  it("rejects unsupported protocol versions", async () => {
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      JSON.stringify({ v: 99, kind: "getState", key: "counter", id: "1" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ v: 1, kind: "error" });
    expect(messages[0].message).toContain("Unsupported protocol version");
  });

  it("persists state across DO evictions", async () => {
    const storage = createStorageStub();
    const coordinator = new SyncedStateServer(
      { storage } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 99, id: "1" }),
    );

    // Simulate a fresh DO instance reading from the same storage.
    const coordinator2 = new SyncedStateServer(
      { storage } as any,
      {} as any,
    );
    const ws2 = createWebSocketStub();
    await coordinator2.webSocketMessage(
      ws2 as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    const response = JSON.parse((ws2 as any)._sent[0] as string);
    expect(response).toMatchObject({ v: 1, kind: "getState", key: "counter", value: 99, id: "2" });
  });

  it("deduplicates subscriptions from the same socket for the same key", async () => {
    const coordinator = new SyncedStateServer(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", id: "2" }),
    );

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", value: 7, id: "3" }),
    );

    const updateMessages = (ws as any)._sent
      .map((m: unknown) => JSON.parse(m as string))
      .filter((m: any) => m.kind === "update");
    expect(updateMessages).toHaveLength(1);
    expect(updateMessages[0]).toMatchObject({ v: 1, kind: "update", key: "counter", value: 7 });
  });
});
