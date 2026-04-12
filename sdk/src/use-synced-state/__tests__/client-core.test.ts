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
  __testing,
} from "../client-core";

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
    vi.useRealTimers();
  });

  it("registers onRpcBroken callback when creating a client", () => {
    getSyncedStateClient("wss://test.example.com/__synced-state");

    expect(mockClients).toHaveLength(1);
    expect(mockClients[0].onRpcBroken).toHaveBeenCalledOnce();
  });

  it("creates a new client after connection breaks", () => {
    getSyncedStateClient("wss://test.example.com/__synced-state");
    expect(mockClients).toHaveLength(1);

    // Simulate connection break
    mockClients[0].simulateBreak();

    // Reconnect happens after backoff (1s for first attempt)
    vi.advanceTimersByTime(1000);

    expect(mockClients).toHaveLength(2);
  });

  it("does not reconnect immediately — waits for backoff", () => {
    getSyncedStateClient("wss://test.example.com/__synced-state");

    mockClients[0].simulateBreak();

    // Before the timer fires, no new session yet
    expect(mockClients).toHaveLength(1);

    vi.advanceTimersByTime(999);
    expect(mockClients).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(mockClients).toHaveLength(2);
  });

  it("re-subscribes active subscriptions after reconnect", async () => {
    const client = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    // Simulate connection break
    mockClients[0].simulateBreak();
    vi.advanceTimersByTime(1000);

    // The new client should have subscribe called with the same key and handler
    const newClient = mockClients[1];
    expect(newClient.subscribe).toHaveBeenCalledWith("counter", handler);
  });

  it("fetches latest state for each subscription after reconnect", async () => {
    const client = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    mockClients[0].simulateBreak();
    vi.advanceTimersByTime(1000);

    const newClient = mockClients[1];
    expect(newClient.getState).toHaveBeenCalledWith("counter");
  });

  it("calls handler with fetched state when value is not undefined", async () => {
    const client = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    // Next client will return a value for getState
    newWebSocketRpcSession.mockImplementationOnce(() => {
      const c = makeMockClient();
      c.getState.mockResolvedValue(42);
      return c;
    });

    mockClients[0].simulateBreak();
    vi.advanceTimersByTime(1000);

    // Allow the getState promise to resolve
    await vi.runAllTimersAsync();

    expect(handler).toHaveBeenCalledWith(42);
  });

  it("does not call handler when fetched state is undefined", async () => {
    const client = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    handler.mockClear();

    mockClients[0].simulateBreak();
    vi.advanceTimersByTime(1000);

    // Default mock returns undefined for getState
    await vi.runAllTimersAsync();

    expect(handler).not.toHaveBeenCalled();
  });

  it("does not re-subscribe keys that were unsubscribed before reconnect", async () => {
    const client = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    await client.unsubscribe("counter", handler);

    mockClients[0].simulateBreak();
    vi.advanceTimersByTime(1000);

    const newClient = mockClients[1];
    expect(newClient.subscribe).not.toHaveBeenCalled();
  });

  it("does not schedule multiple reconnects for the same endpoint", () => {
    getSyncedStateClient("wss://test.example.com/__synced-state");

    // Fire broken twice rapidly
    mockClients[0].simulateBreak();
    mockClients[0].simulateBreak();

    vi.advanceTimersByTime(1000);

    // Should only have created one new session
    expect(mockClients).toHaveLength(2);
  });

  it("uses exponential backoff with a 30s cap", () => {
    expect(__testing.getBackoffMs(0)).toBe(1000);
    expect(__testing.getBackoffMs(1)).toBe(2000);
    expect(__testing.getBackoffMs(2)).toBe(4000);
    expect(__testing.getBackoffMs(3)).toBe(8000);
    expect(__testing.getBackoffMs(4)).toBe(16000);
    expect(__testing.getBackoffMs(5)).toBe(30000); // capped
    expect(__testing.getBackoffMs(10)).toBe(30000); // still capped
  });

  it("returns cached client on second call for same endpoint", () => {
    const client1 = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const client2 = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    expect(client1).toBe(client2);
    expect(mockClients).toHaveLength(1);
  });

  it("re-subscribes multiple subscriptions after reconnect", async () => {
    const client = getSyncedStateClient(
      "wss://test.example.com/__synced-state",
    );
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    await client.subscribe("counter", handler1);
    await client.subscribe("score", handler2);

    mockClients[0].simulateBreak();
    vi.advanceTimersByTime(1000);

    const newClient = mockClients[1];
    expect(newClient.subscribe).toHaveBeenCalledWith("counter", handler1);
    expect(newClient.subscribe).toHaveBeenCalledWith("score", handler2);
    expect(newClient.getState).toHaveBeenCalledWith("counter");
    expect(newClient.getState).toHaveBeenCalledWith("score");
  });
});
