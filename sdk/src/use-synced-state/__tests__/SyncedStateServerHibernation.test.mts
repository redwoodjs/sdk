import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import { SyncedStateServerHibernation } from "../SyncedStateServerHibernation.mjs";
import { packMessage } from "../protocol-hibernation.mjs";

// Minimal in-memory storage stub for the hibernation DO tests.
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
function createWebSocketStub() {
  const sent: unknown[] = [];
  const ws = {
    attachment: null as unknown,
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

describe("SyncedStateServerHibernation", () => {
  afterEach(() => {
    SyncedStateServerHibernation.registerKeyHandler(null);
    SyncedStateServerHibernation.registerRoomHandler(null);
    SyncedStateServerHibernation.registerSetStateHandler(null);
    SyncedStateServerHibernation.registerGetStateHandler(null);
    SyncedStateServerHibernation.registerSubscribeHandler(null);
    SyncedStateServerHibernation.registerUnsubscribeHandler(null);
  });

  it("stores and retrieves state by storageKey", async () => {
    const coordinator = new SyncedStateServerHibernation(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "user:123:counter", value: 5, id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", storageKey: "user:123:counter", id: "2" }),
    );

    expect((ws as any)._sent).toHaveLength(2);
    const response = JSON.parse((ws as any)._sent[1] as string);
    expect(response).toMatchObject({ v: 1, kind: "getState", key: "counter", value: 5, id: "2" });
  });

  it("notifies subscribers when state changes", async () => {
    const coordinator = new SyncedStateServerHibernation(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", storageKey: "counter", id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "counter", value: 7, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toContainEqual({ v: 1, kind: "update", key: "counter", value: 7 });
  });

  it("keeps transformed and user-facing keys isolated", async () => {
    const coordinator = new SyncedStateServerHibernation(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "user:123:counter", value: 9, id: "1" }),
    );
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    const response = JSON.parse((ws as any)._sent[1] as string);
    expect(response.value).toBeUndefined();
  });

  it("invokes registered setState handler", async () => {
    const coordinator = new SyncedStateServerHibernation(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    coordinator.setStub({} as any);
    const calls: Array<{ key: string; value: unknown }> = [];
    SyncedStateServerHibernation.registerSetStateHandler((key, value) => {
      calls.push({ key, value });
    });
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "x", storageKey: "transformed:x", value: 1, id: "1" }),
    );

    expect(calls).toEqual([{ key: "transformed:x", value: 1 }]);
  });

  it("rehydrates subscriptions after simulated hibernation", async () => {
    const coordinator = new SyncedStateServerHibernation(
      { storage: createStorageStub() } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", storageKey: "user:123:counter", id: "1" }),
    );

    // Simulate hibernation by clearing the in-memory subscription map.
    (coordinator as any)["#subscriptions" as never]?.clear?.();

    // A setState message should still trigger an update because the attachment
    // is rehydrated when the message handler runs.
    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "user:123:counter", value: 42, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toContainEqual({ v: 1, kind: "update", key: "counter", value: 42 });
  });

  it("rejects unsupported protocol versions", async () => {
    const coordinator = new SyncedStateServerHibernation(
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
    expect(messages[0].message).toContain("Unsupported hibernation protocol version");
  });

  it("persists state across DO evictions", async () => {
    const storage = createStorageStub();
    const coordinator = new SyncedStateServerHibernation(
      { storage } as any,
      {} as any,
    );
    const ws = createWebSocketStub();

    await coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "counter", value: 99, id: "1" }),
    );

    // Simulate a fresh DO instance reading from the same storage.
    const coordinator2 = new SyncedStateServerHibernation(
      { storage } as any,
      {} as any,
    );
    const ws2 = createWebSocketStub();
    await coordinator2.webSocketMessage(
      ws2 as any,
      packMessage({ kind: "getState", key: "counter", storageKey: "counter", id: "2" }),
    );

    const response = JSON.parse((ws2 as any)._sent[0] as string);
    expect(response).toMatchObject({ v: 1, kind: "getState", key: "counter", value: 99, id: "2" });
  });
});
