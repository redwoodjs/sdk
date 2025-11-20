import type { RpcStub } from "capnweb";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import { SyncedStateServer } from "../SyncedStateServer.mjs";

const createStub = (
  onInvoke: (value: unknown) => Promise<void> | void,
): RpcStub<(value: unknown) => void> => {
  const fn = Object.assign(
    async (value: unknown) => {
      await onInvoke(value);
    },
    {
      dup: () => fn,
    },
  );
  return fn as unknown as RpcStub<(value: unknown) => void>;
};

describe("SyncedStateServer", () => {
  it("notifies subscribers when state changes", async () => {
    const coordinator = new SyncedStateServer({} as any, {} as any);
    const received: unknown[] = [];
    const stub = createStub((value) => {
      received.push(value);
    });

    coordinator.subscribe("counter", stub);
    coordinator.setState(5, "counter");

    expect(coordinator.getState("counter")).toBe(5);
    expect(received).toEqual([5]);
  });

  it("removes subscriptions on unsubscribe", () => {
    const coordinator = new SyncedStateServer({} as any, {} as any);
    const stub = createStub(() => {});

    coordinator.subscribe("counter", stub);
    coordinator.unsubscribe("counter", stub);
    coordinator.setState(1, "counter");

    expect(coordinator.getState("counter")).toBe(1);
  });

  it("drops failing subscribers", async () => {
    const coordinator = new SyncedStateServer({} as any, {} as any);
    const stub = createStub(async () => {
      throw new Error("fail");
    });

    coordinator.subscribe("counter", stub);
    coordinator.setState(3, "counter");

    await Promise.resolve();

    coordinator.setState(4, "counter");
    expect(coordinator.getState("counter")).toBe(4);
  });

  it("invokes registered onSet handler", () => {
    const coordinator = new SyncedStateServer({} as any, {} as any);
    const calls: Array<{ key: string; value: unknown }> = [];
    SyncedStateServer.registerSetStateHandler((key, value) => {
      calls.push({ key, value });
    });

    coordinator.setState(2, "counter");

    expect(calls).toEqual([{ key: "counter", value: 2 }]);

    SyncedStateServer.registerSetStateHandler(null);
  });

  it("invokes registered onGet handler", () => {
    const coordinator = new SyncedStateServer({} as any, {} as any);
    const calls: Array<{ key: string; value: unknown }> = [];
    SyncedStateServer.registerGetStateHandler((key, value) => {
      calls.push({ key, value });
    });

    coordinator.setState(4, "counter");
    expect(coordinator.getState("counter")).toBe(4);
    expect(calls).toEqual([{ key: "counter", value: 4 }]);

    SyncedStateServer.registerGetStateHandler(null);
  });

  describe("registerKeyHandler", () => {
    afterEach(() => {
      SyncedStateServer.registerKeyHandler(async (key) => key);
    });

    it("stores and retrieves the registered handler", async () => {
      const handler = async (key: string) => `transformed:${key}`;
      SyncedStateServer.registerKeyHandler(handler);

      const retrievedHandler = SyncedStateServer.getKeyHandler();
      expect(retrievedHandler).toBe(handler);
    });

    it("transforms keys using the registered handler", async () => {
      const handler = async (key: string) => `user:123:${key}`;
      SyncedStateServer.registerKeyHandler(handler);

      const result = await handler("counter");
      expect(result).toBe("user:123:counter");
    });

    it("returns null when no handler is registered", () => {
      SyncedStateServer.registerKeyHandler(async (key) => key);
      const handler = SyncedStateServer.getKeyHandler();
      expect(handler).not.toBeNull();
    });

    it("allows handler to be async", async () => {
      const handler = async (key: string) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return `async:${key}`;
      };
      SyncedStateServer.registerKeyHandler(handler);

      const result = await handler("test");
      expect(result).toBe("async:test");
    });

    it("handler receives the correct key parameter", async () => {
      let receivedKey = "";
      const handler = async (key: string) => {
        receivedKey = key;
        return key;
      };
      SyncedStateServer.registerKeyHandler(handler);

      await handler("myKey");
      expect(receivedKey).toBe("myKey");
    });
  });
});
