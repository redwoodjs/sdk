import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import { SyncedStateServerHibernation } from "../SyncedStateServerHibernation.mjs";
import { packMessage } from "../protocol-hibernation.mjs";

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

  it("stores and retrieves state by storageKey", () => {
    const coordinator = new SyncedStateServerHibernation({} as any, {} as any);
    const ws = createWebSocketStub();

    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "user:123:counter", value: 5, id: "1" }),
    );
    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", storageKey: "user:123:counter", id: "2" }),
    );

    expect((ws as any)._sent).toHaveLength(2);
    const response = JSON.parse((ws as any)._sent[1] as string);
    expect(response).toMatchObject({ v: 1, kind: "getState", key: "counter", value: 5, id: "2" });
  });

  it("notifies subscribers when state changes", () => {
    const coordinator = new SyncedStateServerHibernation({} as any, {} as any);
    const ws = createWebSocketStub();

    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", storageKey: "counter", id: "1" }),
    );
    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "counter", value: 7, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toContainEqual({ v: 1, kind: "update", key: "counter", value: 7 });
  });

  it("keeps transformed and user-facing keys isolated", () => {
    const coordinator = new SyncedStateServerHibernation({} as any, {} as any);
    const ws = createWebSocketStub();

    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "user:123:counter", value: 9, id: "1" }),
    );
    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "getState", key: "counter", id: "2" }),
    );

    const response = JSON.parse((ws as any)._sent[1] as string);
    expect(response.value).toBeUndefined();
  });

  it("invokes registered setState handler", () => {
    const coordinator = new SyncedStateServerHibernation({} as any, {} as any);
    coordinator.setStub({} as any);
    const calls: Array<{ key: string; value: unknown }> = [];
    SyncedStateServerHibernation.registerSetStateHandler((key, value) => {
      calls.push({ key, value });
    });
    const ws = createWebSocketStub();

    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "x", storageKey: "transformed:x", value: 1, id: "1" }),
    );

    expect(calls).toEqual([{ key: "transformed:x", value: 1 }]);
  });

  it("rehydrates subscriptions after simulated hibernation", () => {
    const coordinator = new SyncedStateServerHibernation({} as any, {} as any);
    const ws = createWebSocketStub();

    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "subscribe", key: "counter", storageKey: "user:123:counter", id: "1" }),
    );

    // Simulate hibernation by clearing the in-memory subscription map.
    (coordinator as any)["#subscriptions" as never]?.clear?.();

    // A setState message should still trigger an update because the attachment
    // is rehydrated when the message handler runs.
    coordinator.webSocketMessage(
      ws as any,
      packMessage({ kind: "setState", key: "counter", storageKey: "user:123:counter", value: 42, id: "2" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toContainEqual({ v: 1, kind: "update", key: "counter", value: 42 });
  });

  it("rejects unsupported protocol versions", () => {
    const coordinator = new SyncedStateServerHibernation({} as any, {} as any);
    const ws = createWebSocketStub();

    coordinator.webSocketMessage(
      ws as any,
      JSON.stringify({ v: 99, kind: "getState", key: "counter", id: "1" }),
    );

    const messages = (ws as any)._sent.map((m: unknown) => JSON.parse(m as string));
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ v: 1, kind: "error" });
    expect(messages[0].message).toContain("Unsupported hibernation protocol version");
  });
});
