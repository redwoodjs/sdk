import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import {
  SyncStateCoordinator,
  registerSetStateCallback,
  registerGetStateCallback,
} from "../Coordinator.mjs";

const createStub = (onInvoke: (value: unknown) => Promise<void> | void) => {
  const fn = Object.assign(
    (value: unknown) => Promise.resolve(onInvoke(value)),
    {
      dup: () => fn,
    },
  );
  return fn;
};

describe("SyncStateCoordinator", () => {
  it("notifies subscribers when state changes", async () => {
    const coordinator = new SyncStateCoordinator({} as any, {} as any);
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
    const coordinator = new SyncStateCoordinator({} as any, {} as any);
    const stub = createStub(() => {});

    coordinator.subscribe("counter", stub);
    coordinator.unsubscribe("counter", stub);
    coordinator.setState(1, "counter");

    expect(coordinator.getState("counter")).toBe(1);
  });

  it("drops failing subscribers", async () => {
    const coordinator = new SyncStateCoordinator({} as any, {} as any);
    const stub = Object.assign(() => Promise.reject(new Error("fail")), {
      dup: () => stub,
    });

    coordinator.subscribe("counter", stub as any);
    coordinator.setState(3, "counter");

    await Promise.resolve();

    coordinator.setState(4, "counter");
    expect(coordinator.getState("counter")).toBe(4);
  });

  it("invokes registered onSet handler", () => {
    const coordinator = new SyncStateCoordinator({} as any, {} as any);
    const calls: Array<{ key: string; value: unknown }> = [];
    registerSetStateCallback((key, value) => {
      calls.push({ key, value });
    });

    coordinator.setState(2, "counter");

    expect(calls).toEqual([{ key: "counter", value: 2 }]);

    registerSetStateCallback(null);
  });

  it("invokes registered onGet handler", () => {
    const coordinator = new SyncStateCoordinator({} as any, {} as any);
    const calls: Array<{ key: string; value: unknown }> = [];
    registerGetStateCallback((key, value) => {
      calls.push({ key, value });
    });

    coordinator.setState(4, "counter");
    expect(coordinator.getState("counter")).toBe(4);
    expect(calls).toEqual([{ key: "counter", value: 4 }]);

    registerGetStateCallback(null);
  });
});
