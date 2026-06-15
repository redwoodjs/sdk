import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockClients: Array<Record<string, any>> = [];

const { newWebSocketRpcSession } = vi.hoisted(() => {
  return {
    newWebSocketRpcSession: vi.fn(),
  };
});

vi.mock("capnweb", () => ({
  newWebSocketRpcSession,
}));

const reloadMock = vi.fn();

function makeMockClient() {
  let brokenCb: ((error: any) => void) | null = null;
  const client: Record<string, any> = {
    getState: vi.fn().mockResolvedValue(undefined),
    setState: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    onRpcBroken: vi.fn((cb: (error: any) => void) => {
      brokenCb = cb;
    }),
    // Helper to simulate a connection break from tests
    simulateBreak(error = new Error("connection lost")) {
      brokenCb?.(error);
    },
  };
  mockClients.push(client);
  return client;
}

import {
  __testing,
  getSyncedStateClient,
  onStatusChange,
} from "../client-core";

const ENDPOINT = "wss://test.example.com/__synced-state";

describe("client-core", () => {
  beforeEach(() => {
    mockClients.length = 0;
    newWebSocketRpcSession.mockReset();
    newWebSocketRpcSession.mockImplementation(() => makeMockClient());
    __testing.clientCache.clear();
    __testing.activeSubscriptions.clear();
    __testing.statusListeners.clear();
    vi.stubGlobal("window", {
      location: { protocol: "https:", host: "example.com", reload: reloadMock },
      addEventListener: () => {},
    });
  });

  afterEach(() => {
    __testing.clientCache.clear();
    __testing.activeSubscriptions.clear();
    __testing.statusListeners.clear();
    vi.unstubAllGlobals();
    reloadMock.mockClear();
  });

  it("registers onRpcBroken callback when creating a client", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    expect(mockClients).toHaveLength(1);
    expect(mockClients[0].onRpcBroken).toHaveBeenCalledOnce();
  });

  it("reloads the page when the RPC session breaks", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    mockClients[0].simulateBreak();

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("notifies status listeners of 'disconnected' when the session breaks", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    const statusCb = vi.fn();
    onStatusChange(ENDPOINT, statusCb);

    mockClients[0].simulateBreak();

    expect(statusCb).toHaveBeenCalledWith("disconnected");
  });

  it("returns cached client on second call for same endpoint", () => {
    const client1 = getSyncedStateClient(ENDPOINT);
    const client2 = getSyncedStateClient(ENDPOINT);
    expect(client1).toBe(client2);
  });

  it("returns different clients for different endpoints", async () => {
    const client1 = getSyncedStateClient(ENDPOINT);
    const client2 = getSyncedStateClient("wss://test.example.com/__other");
    expect(client1).not.toBe(client2);
  });

  it("tracks subscriptions and removes them on unsubscribe", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    expect(__testing.activeSubscriptions.size).toBe(1);

    await client.unsubscribe("counter", handler);
    expect(__testing.activeSubscriptions.size).toBe(0);
  });

  it("forwards method calls to the underlying capnweb session", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    expect(mockClients[0].subscribe).toHaveBeenCalledWith("counter", handler);
  });

  describe("onStatusChange", () => {
    it("returns an unsubscribe function that stops notifications", async () => {
      getSyncedStateClient(ENDPOINT);
      await __testing.warmUp(ENDPOINT);
      const statusCb = vi.fn();
      const unsub = onStatusChange(ENDPOINT, statusCb);

      unsub();
      mockClients[0].simulateBreak();

      expect(statusCb).not.toHaveBeenCalled();
    });

    it("supports multiple listeners on the same endpoint", async () => {
      getSyncedStateClient(ENDPOINT);
      await __testing.warmUp(ENDPOINT);
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      onStatusChange(ENDPOINT, cb1);
      onStatusChange(ENDPOINT, cb2);

      mockClients[0].simulateBreak();

      expect(cb1).toHaveBeenCalledWith("disconnected");
      expect(cb2).toHaveBeenCalledWith("disconnected");
    });

    it("supports listeners registered with relative URLs", async () => {
      vi.stubGlobal("window", {
        location: {
          protocol: "https:",
          host: "example.com",
          reload: reloadMock,
        },
        addEventListener: () => {},
      });

      const RELATIVE = "/__synced-state";
      const statusCb = vi.fn();

      onStatusChange(RELATIVE, statusCb);
      getSyncedStateClient(RELATIVE);
      await __testing.warmUp(RELATIVE);

      mockClients[0].simulateBreak();

      expect(statusCb).toHaveBeenCalledWith("disconnected");
    });
  });
});
