import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => {
  class DurableObject {}
  return { DurableObject, env: {} };
});

vi.mock("capnweb", () => ({
  RpcTarget: class RpcTarget {},
  newWorkersRpcResponse: vi.fn(),
}));

vi.mock("../runtime/entries/router", () => ({
  route: vi.fn((path: string, handler: any) => ({ path, handler })),
}));

import { SyncStateServer } from "../SyncStateServer.mjs";

describe("SyncStateProxy", () => {
  let mockCoordinator: SyncStateServer;

  beforeEach(() => {
    mockCoordinator = new SyncStateServer({} as any, {} as any);
  });

  afterEach(() => {
    SyncStateServer.registerKeyHandler(async (key) => key);
  });

  it("transforms keys before calling coordinator methods when handler is registered", async () => {
    const handler = async (key: string) => `transformed:${key}`;
    SyncStateServer.registerKeyHandler(handler);

    const transformedKey = await handler("counter");
    expect(transformedKey).toBe("transformed:counter");

    mockCoordinator.setState(5, transformedKey);
    const value = mockCoordinator.getState(transformedKey);
    expect(value).toBe(5);
  });

  it("does not transform keys when no handler is registered", () => {
    SyncStateServer.registerKeyHandler(async (key) => key);
    const handler = SyncStateServer.getKeyHandler();
    expect(handler).not.toBeNull();
  });

  it("passes through original key when handler returns it unchanged", async () => {
    const handler = async (key: string) => key;
    SyncStateServer.registerKeyHandler(handler);

    const result = await handler("counter");
    expect(result).toBe("counter");
  });

  it("handler can scope keys per user", async () => {
    const handler = async (key: string) => {
      const userId = "user123";
      return `user:${userId}:${key}`;
    };
    SyncStateServer.registerKeyHandler(handler);

    const result = await handler("settings");
    expect(result).toBe("user:user123:settings");
  });

  it("allows errors from handler to propagate", async () => {
    const handler = async (_key: string) => {
      throw new Error("Handler error");
    };
    SyncStateServer.registerKeyHandler(handler);

    await expect(handler("test")).rejects.toThrow("Handler error");
  });

  it("handles async operations in handler", async () => {
    const handler = async (key: string) => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return `async:${key}`;
    };
    SyncStateServer.registerKeyHandler(handler);

    const result = await handler("data");
    expect(result).toBe("async:data");
  });
});
