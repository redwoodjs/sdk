import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const mockClients: Array<Record<string, any>> = [];

const { newWebSocketRpcSession } = vi.hoisted(() => {
  return {
    newWebSocketRpcSession: vi.fn(),
  };
});

const { startRecovery } = vi.hoisted(() => {
  return {
    startRecovery: vi.fn(),
  };
});

vi.mock("capnweb", () => ({
  newWebSocketRpcSession,
}));

vi.mock("../../runtime/client/recovery.js", () => ({
  startRecovery,
}));

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
    simulateBreak(error = new Error("connection lost")) {
      brokenCb?.(error);
    },
  };
  mockClients.push(client);
  return client;
}

import {
  getSyncedStateClient,
  setSyncedStateClientForTesting,
  onStatusChange,
  __testing,
} from "../client-core";

const ENDPOINT = "wss://test.example.com/__synced-state";

describe("client-core recovery", () => {
  beforeEach(() => {
    mockClients.length = 0;
    newWebSocketRpcSession.mockReset();
    newWebSocketRpcSession.mockImplementation(() => makeMockClient());
    startRecovery.mockReset();
    __testing.clientCache.clear();
    __testing.activeSubscriptions.clear();
    __testing.statusListeners.clear();
  });

  afterEach(() => {
    __testing.clientCache.clear();
    __testing.activeSubscriptions.clear();
    __testing.statusListeners.clear();
    setSyncedStateClientForTesting(null);
  });

  it("registers onRpcBroken callback when creating a client", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    expect(mockClients).toHaveLength(1);
    expect(mockClients[0].onRpcBroken).toHaveBeenCalledOnce();
  });

  it("fires 'disconnected' and schedules a reconnect when the RPC session breaks", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    const statusCb = vi.fn();
    onStatusChange(ENDPOINT, statusCb);

    mockClients[0].simulateBreak();

    expect(statusCb).toHaveBeenCalledWith("disconnected");
    expect(__testing.backoffState.get(ENDPOINT)?.timer).not.toBeNull();
  });

  it("returns cached client on second call for same endpoint", async () => {
    const client1 = getSyncedStateClient(ENDPOINT);
    const client2 = getSyncedStateClient(ENDPOINT);
    expect(client1).toBe(client2);
    await __testing.warmUp(ENDPOINT);
    expect(mockClients).toHaveLength(1);
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
  });
});
