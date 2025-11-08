import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject };
});

import { SyncedStateCoordinator } from "../Coordinator.mjs";

const createStub = (onInvoke: (value: unknown) => Promise<void> | void) => {
  const fn = Object.assign(
    (value: unknown) => Promise.resolve(onInvoke(value)),
    {
      dup: () => fn,
    },
  );
  return fn;
};

describe("SyncedStateCoordinator", () => {
  it("notifies subscribers when state changes", async () => {
    const coordinator = new SyncedStateCoordinator({} as any, {} as any);
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
    const coordinator = new SyncedStateCoordinator({} as any, {} as any);
    const stub = createStub(() => {});

    coordinator.subscribe("counter", stub);
    coordinator.unsubscribe("counter", stub);
    coordinator.setState(1, "counter");

    expect(coordinator.getState("counter")).toBe(1);
  });

  it("drops failing subscribers", async () => {
    const coordinator = new SyncedStateCoordinator({} as any, {} as any);
    const stub = Object.assign(() => Promise.reject(new Error("fail")), {
      dup: () => stub,
    });

    coordinator.subscribe("counter", stub as any);
    coordinator.setState(3, "counter");

    await Promise.resolve();

    coordinator.setState(4, "counter");
    expect(coordinator.getState("counter")).toBe(4);
  });
});
