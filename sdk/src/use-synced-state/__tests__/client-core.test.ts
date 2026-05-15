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

vi.mock("capnweb", () => ({
  newWebSocketRpcSession,
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
    // Helper to simulate a connection break from tests
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

describe("client-core reconnection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockClients.length = 0;
    newWebSocketRpcSession.mockReset();
    newWebSocketRpcSession.mockImplementation(() => makeMockClient());
    // Clear all internal state between tests
    __testing.clientCache.clear();
    __testing.activeSubscriptions.clear();
    for (const [, state] of __testing.backoffState) {
      if (state.timer !== null) clearTimeout(state.timer);
    }
    __testing.backoffState.clear();
  });

  afterEach(() => {
    __testing.clientCache.clear();
    __testing.activeSubscriptions.clear();
    __testing.backoffState.clear();
    __testing.statusListeners.clear();
    vi.useRealTimers();
  });

  it("registers onRpcBroken callback when creating a client", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    expect(mockClients).toHaveLength(1);
    expect(mockClients[0].onRpcBroken).toHaveBeenCalledOnce();
  });

  it("creates a new client after connection breaks", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);
    expect(mockClients).toHaveLength(1);

    // Simulate connection break
    mockClients[0].simulateBreak();

    // Reconnect happens after backoff timer fires
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    expect(mockClients).toHaveLength(2);
  });

  it("does not reconnect immediately — waits for backoff", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    mockClients[0].simulateBreak();

    // Before the timer fires, no new session yet
    expect(mockClients).toHaveLength(1);

    // After timer fires, reconnect happens
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);
    expect(mockClients).toHaveLength(2);
  });

  it("re-subscribes active subscriptions after reconnect", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    // Simulate connection break
    mockClients[0].simulateBreak();
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    // The new client should have subscribe called with the same key and handler
    const newClient = mockClients[1];
    expect(newClient.subscribe).toHaveBeenCalledWith("counter", handler);
  });

  it("fetches latest state for each subscription after reconnect", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    mockClients[0].simulateBreak();
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    const newClient = mockClients[1];
    expect(newClient.getState).toHaveBeenCalledWith("counter");
  });

  it("calls handler with fetched state when value is not undefined", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    // Next client will return a value for getState
    newWebSocketRpcSession.mockImplementationOnce(() => {
      const c = makeMockClient();
      c.getState.mockResolvedValue(42);
      return c;
    });

    mockClients[0].simulateBreak();
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    // Allow the getState promise to resolve
    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith(42);
  });

  it("does not call handler when fetched state is undefined", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    handler.mockClear();

    mockClients[0].simulateBreak();
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    // Default mock returns undefined for getState
    await vi.runAllTimersAsync();

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not re-subscribe keys that were unsubscribed before reconnect", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    await client.unsubscribe("counter", handler);

    mockClients[0].simulateBreak();
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    const newClient = mockClients[1];
    expect(newClient.subscribe).not.toHaveBeenCalled();
  });

  it("does not schedule multiple reconnects for the same endpoint", async () => {
    getSyncedStateClient(ENDPOINT);
    await __testing.warmUp(ENDPOINT);

    // Fire broken twice rapidly
    mockClients[0].simulateBreak();
    mockClients[0].simulateBreak();

    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    // Should only have created one new session
    expect(mockClients).toHaveLength(2);
  });

  it("uses exponential backoff with jitter and a 30s cap", () => {
    // Backoff is base * (0.75..1.25) due to ±25% jitter, so we check ranges
    const inRange = (val: number, min: number, max: number) =>
      val >= min && val <= max;

    expect(inRange(__testing.getBackoffMs(0), 750, 1250)).toBe(true);   // base 1000
    expect(inRange(__testing.getBackoffMs(1), 1500, 2500)).toBe(true);  // base 2000
    expect(inRange(__testing.getBackoffMs(2), 3000, 5000)).toBe(true);  // base 4000
    expect(inRange(__testing.getBackoffMs(3), 6000, 10000)).toBe(true); // base 8000
    expect(inRange(__testing.getBackoffMs(5), 22500, 30000)).toBe(true); // capped at 30000
    expect(inRange(__testing.getBackoffMs(10), 22500, 30000)).toBe(true); // still capped
  });

  it("returns cached client on second call for same endpoint", async () => {
    const client1 = getSyncedStateClient(ENDPOINT);
    const client2 = getSyncedStateClient(ENDPOINT);
    expect(client1).toBe(client2);
    await __testing.warmUp(ENDPOINT);
    expect(mockClients).toHaveLength(1);
  });

  it("re-subscribes multiple subscriptions after reconnect", async () => {
    const client = getSyncedStateClient(ENDPOINT);
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    await client.subscribe("counter", handler1);
    await client.subscribe("score", handler2);

    mockClients[0].simulateBreak();
    vi.runOnlyPendingTimers();
    await __testing.warmUp(ENDPOINT);

    const newClient = mockClients[1];
    expect(newClient.subscribe).toHaveBeenCalledWith("counter", handler1);
    expect(newClient.subscribe).toHaveBeenCalledWith("score", handler2);
    expect(newClient.getState).toHaveBeenCalledWith("counter");
    expect(newClient.getState).toHaveBeenCalledWith("score");
  });

  describe("onStatusChange", () => {
    it("fires 'disconnected' immediately when connection breaks", async () => {
      getSyncedStateClient(ENDPOINT);
      await __testing.warmUp(ENDPOINT);
      const statusCb = vi.fn();
      onStatusChange(ENDPOINT, statusCb);

      mockClients[0].simulateBreak();

      expect(statusCb).toHaveBeenCalledWith("disconnected");
    });

    it("fires 'reconnecting' then 'connected' when reconnect completes", async () => {
      getSyncedStateClient(ENDPOINT);
      await __testing.warmUp(ENDPOINT);
      const statusCb = vi.fn();
      onStatusChange(ENDPOINT, statusCb);

      mockClients[0].simulateBreak();
      statusCb.mockClear();

      vi.runOnlyPendingTimers();
      await vi.runAllTimersAsync();

      expect(statusCb).toHaveBeenCalledTimes(2);
      expect(statusCb).toHaveBeenNthCalledWith(1, "reconnecting");
      expect(statusCb).toHaveBeenNthCalledWith(2, "connected");
    });

    it("fires full lifecycle: disconnected → reconnecting → connected", async () => {
      getSyncedStateClient(ENDPOINT);
      await __testing.warmUp(ENDPOINT);
      const statuses: string[] = [];
      onStatusChange(ENDPOINT, (s) => statuses.push(s));

      mockClients[0].simulateBreak();
      vi.runOnlyPendingTimers();
      await vi.runAllTimersAsync();

      expect(statuses).toEqual(["disconnected", "reconnecting", "connected"]);
    });

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

  // ============================================================
  // REPRODUCTIONS: Failing tests demonstrating Copilot-flagged bugs
  // ============================================================
  describe("REPRO: bug reproductions", () => {
    it("BUG: status listener registered with relative URL never fires because reconnect uses the normalized absolute URL", async () => {
      // Stub window so relative URLs get normalized inside getSyncedStateClient
      vi.stubGlobal("window", {
        location: { protocol: "https:", host: "example.com" },
        addEventListener: () => {},
      });

      const RELATIVE = "/__synced-state";
      const statusCb = vi.fn();

      // This mirrors what useSyncedState.ts does: register listener with
      // the same (relative) string it passes to getSyncedStateClient.
      onStatusChange(RELATIVE, statusCb);
      getSyncedStateClient(RELATIVE);
      await __testing.warmUp(RELATIVE);

      mockClients[0].simulateBreak();
      vi.runOnlyPendingTimers();

      // Expected: full lifecycle fires. Actual: nothing fires because
      // reconnect notifies using "wss://example.com/__synced-state"
      // but the listener is stored under "/__synced-state".
      expect(statusCb).toHaveBeenCalledWith("disconnected");

      vi.unstubAllGlobals();
    });

    it("BUG: unsubscribing one of two instances of the same callback removes it for all", async () => {
      getSyncedStateClient(ENDPOINT);
      await __testing.warmUp(ENDPOINT);

      // Simulate two React components sharing the same onStatusChange
      // callback (the case when createSyncedStateHook({ onStatusChange })
      // is used by multiple component instances).
      const sharedCallback = vi.fn();
      const unsubA = onStatusChange(ENDPOINT, sharedCallback);
      const unsubB = onStatusChange(ENDPOINT, sharedCallback);

      // Component A unmounts
      unsubA();

      // Component B is still mounted and should still receive updates
      mockClients[0].simulateBreak();

      // Expected: callback fires once (for B). Actual: fires zero times
      // because Set.delete removed the single shared entry.
      expect(sharedCallback).toHaveBeenCalledWith("disconnected");

      unsubB();
    });

    it("BUG: reconnect emits 'connected' and resets backoff even when subscribe() rejects", async () => {
      const client = getSyncedStateClient(ENDPOINT);
      const handler = vi.fn();

      await client.subscribe("counter", handler);

      // Next client's subscribe will reject
      newWebSocketRpcSession.mockImplementationOnce(() => {
        const c = makeMockClient();
        c.subscribe.mockRejectedValue(new Error("subscribe failed"));
        return c;
      });

      const statuses: string[] = [];
      onStatusChange(ENDPOINT, (s) => statuses.push(s));

      mockClients[0].simulateBreak();
      vi.runOnlyPendingTimers();
      await vi.runAllTimersAsync();

      // Expected: on failure, we should NOT claim connected and NOT reset backoff.
      // Actual: "connected" fires and backoff resets to 0 despite the failure.
      expect(statuses).not.toContain("connected");
      expect(__testing.backoffState.get(ENDPOINT)?.attempt ?? 0).toBeGreaterThan(0);
    });
  });
});
