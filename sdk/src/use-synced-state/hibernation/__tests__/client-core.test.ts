import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { WebSocketServer, WebSocket } from "ws";

import {
  getSyncedStateClient,
  onStatusChange,
  setSyncedStateClientForTesting,
  __testing,
} from "../client-core.js";
import { type ServerMessage, type ClientMessage } from "../protocol.mjs";

const { DEAD_CONNECTION_TIMEOUT_MS, getBackoffMs } = __testing;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (ws.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }
    const timer = setTimeout(() => reject(new Error("waitForOpen timeout")), 2000);
    ws.addEventListener("open", () => {
      clearTimeout(timer);
      resolve();
    });
    ws.addEventListener("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function waitForCondition<T>(
  fn: () => T | undefined,
  timeoutMs = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs;
    const check = () => {
      const value = fn();
      if (value !== undefined) {
        resolve(value);
        return;
      }
      if (Date.now() >= deadline) {
        reject(new Error("waitForCondition timeout"));
        return;
      }
      setTimeout(check, 10);
    };
    check();
  });
}

function send(ws: WebSocket, message: ServerMessage) {
  ws.send(JSON.stringify({ v: 1, ...message }));
}

function collectMessages(ws: WebSocket): ClientMessage[] {
  const messages: ClientMessage[] = [];
  ws.on("message", (data) => {
    messages.push(JSON.parse(data.toString()) as ClientMessage);
  });
  return messages;
}

describe("client-core", () => {
  let wss: WebSocketServer;
  let serverSockets: WebSocket[] = [];
  let serverMessages: ClientMessage[][] = [];
  let clients: WebSocket[] = [];

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    setSyncedStateClientForTesting(null);

    serverSockets = [];
    serverMessages = [];
    clients = [];

    wss = new WebSocketServer({ port: 0 });
    wss.on("connection", (ws) => {
      serverSockets.push(ws);
      serverMessages.push(collectMessages(ws));
    });

    await wait(10);
  });

  afterEach(() => {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    wss.clients.forEach((ws) => ws.close());
    wss.close();
    setSyncedStateClientForTesting(null);
    vi.useRealTimers();
  });

  function getEndpoint() {
    return `ws://localhost:${(wss.address() as any).port}`;
  }

  function createClient(endpoint?: string) {
    const wsFactory = (url: string) => {
      const ws = new WebSocket(url) as unknown as globalThis.WebSocket;
      clients.push(ws as unknown as WebSocket);
      return ws;
    };
    return getSyncedStateClient(endpoint ?? getEndpoint(), wsFactory);
  }

  it("opens a connection and sends subscribe/getState on subscribe", async () => {
    const client = createClient();
    const handler = vi.fn();

    await client.subscribe("counter", handler);

    const serverSocket = await waitForCondition(() => serverSockets[0]);
    await waitForOpen(clients[0] as unknown as WebSocket);

    await waitForCondition(() =>
      serverMessages[0].length >= 2 ? serverMessages[0] : undefined,
    );

    expect(serverMessages[0][0]).toMatchObject({
      v: 1,
      kind: "subscribe",
      key: "counter",
    });
    expect(serverMessages[0][1]).toMatchObject({
      v: 1,
      kind: "getState",
      key: "counter",
    });

    send(serverSocket, {
      kind: "getState",
      key: "counter",
      value: 42,
      id: serverMessages[0][1].id,
    });

    await waitForCondition(() => (handler.mock.calls.length > 0 ? true : undefined));
    expect(handler).toHaveBeenCalledWith(42);
  });

  it("re-subscribes after a disconnect/reconnect", async () => {
    const client = createClient();
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    await waitForOpen(clients[0] as unknown as WebSocket);

    await waitForCondition(() =>
      serverMessages[0].length >= 2 ? serverMessages[0] : undefined,
    );
    expect(serverMessages[0][0]).toMatchObject({
      kind: "subscribe",
      key: "counter",
    });

    // Simulate server-side close.
    serverSockets[0].close();
    await wait(0);

    // Advance past the jittered first reconnect delay.
    await vi.advanceTimersByTimeAsync(2000);

    // Wait for the reconnect to create a second server socket.
    await waitForCondition(() => serverSockets[1]);

    await waitForCondition(() =>
      serverMessages[1].length >= 2 ? serverMessages[1] : undefined,
    );

    expect(serverMessages[1][0]).toMatchObject({
      v: 1,
      kind: "subscribe",
      key: "counter",
    });
    expect(serverMessages[1][1]).toMatchObject({
      v: 1,
      kind: "getState",
      key: "counter",
    });
  });

  it("delivers update messages to registered handlers", async () => {
    const client = createClient();
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    await waitForOpen(clients[0] as unknown as WebSocket);

    const serverSocket = await waitForCondition(() => serverSockets[0]);
    send(serverSocket, { kind: "update", key: "counter", value: 7 });

    await waitForCondition(() => (handler.mock.calls.length > 0 ? true : undefined));
    expect(handler).toHaveBeenCalledWith(7);
  });

  it("does not deliver updates for unsubscribed keys", async () => {
    const client = createClient();
    const handler = vi.fn();

    await client.subscribe("counter", handler);
    await client.unsubscribe("counter", handler);
    await waitForOpen(clients[0] as unknown as WebSocket);

    const serverSocket = await waitForCondition(() => serverSockets[0]);
    send(serverSocket, { kind: "update", key: "counter", value: 7 });

    await wait(50);
    expect(handler).not.toHaveBeenCalled();
  });

  it("rejects pending getState requests when the socket closes", async () => {
    const client = createClient();
    const getStatePromise = client.getState("counter");
    getStatePromise.catch(() => {});

    await waitForOpen(clients[0] as unknown as WebSocket);
    serverSockets[0].close();

    await expect(getStatePromise).rejects.toThrow("WebSocket closed");
  });

  it("queues messages sent before the socket opens", async () => {
    const client = createClient();
    const getStatePromise = client.getState("counter");

    await waitForOpen(clients[0] as unknown as WebSocket);

    const serverSocket = await waitForCondition(() => serverSockets[0]);
    await waitForCondition(() =>
      serverMessages[0].length >= 1 ? serverMessages[0] : undefined,
    );

    expect(serverMessages[0][0]).toMatchObject({
      v: 1,
      kind: "getState",
      key: "counter",
    });

    send(serverSocket, {
      kind: "getState",
      key: "counter",
      value: 99,
      id: serverMessages[0][0].id,
    });

    await expect(getStatePromise).resolves.toBe(99);
  });

  it("notifies status listeners through connect, disconnect, and reconnect", async () => {
    const endpoint = getEndpoint();
    const statusChanges: string[] = [];
    onStatusChange(endpoint, (status) => statusChanges.push(status));

    const client = createClient(endpoint);
    await client.subscribe("counter", () => {});

    await waitForCondition(() => statusChanges.includes("connected") ? true : undefined);

    serverSockets[0].close();
    await waitForCondition(() => statusChanges.includes("disconnected") ? true : undefined);

    await vi.advanceTimersByTimeAsync(2000);
    await waitForCondition(() => statusChanges.includes("reconnecting") ? true : undefined);

    await waitForCondition(
      () => statusChanges.filter((s) => s === "connected").length >= 2 ? true : undefined,
      3000,
    );
    expect(statusChanges.filter((s) => s === "connected")).toHaveLength(2);
  });

  it("force-closes the socket when no message is received within the dead-connection timeout", async () => {
    const client = createClient();
    await client.subscribe("counter", () => {});
    await waitForOpen(clients[0] as unknown as WebSocket);

    const firstSocket = clients[0] as unknown as WebSocket;
    const closePromise = new Promise<void>((res) => firstSocket.once("close", () => res()));

    await vi.advanceTimersByTimeAsync(DEAD_CONNECTION_TIMEOUT_MS + 1000);
    await closePromise;

    expect(firstSocket.readyState).toBe(WebSocket.CLOSED);
  });

  it("resets the dead-connection timer on incoming messages", async () => {
    const client = createClient();
    await client.subscribe("counter", () => {});
    await waitForOpen(clients[0] as unknown as WebSocket);

    const serverSocket = await waitForCondition(() => serverSockets[0]);
    const closeSpy = vi.fn();
    serverSocket.once("close", closeSpy);

    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(80_000);
      send(serverSocket, { kind: "update", key: "counter", value: i });
      await wait(0);
    }

    expect(closeSpy).not.toHaveBeenCalled();
  });

  it("uses exponential backoff with jitter for reconnections", () => {
    const delays = new Set<number>();
    for (let attempt = 0; attempt < 10; attempt++) {
      delays.add(getBackoffMs(attempt));
    }
    expect(delays.size).toBeGreaterThan(1);
    for (const delay of delays) {
      expect(delay).toBeLessThanOrEqual(30_000);
    }
  });
});
