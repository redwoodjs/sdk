import { describe, it, expect, vi } from "vitest";
import { OpenDO } from "./open-do.js";
import { OpenDORegistry } from "./registry.js";

// Mock WebSocket
class MockWebSocket extends EventTarget {
  readyState = 1;
  constructor() {
    super();
  }
  close() {
    this.dispatchEvent(new Event("close"));
  }
}

// @ts-ignore
globalThis.WebSocket = MockWebSocket;

class WebSocketDO extends OpenDO {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/connect") {
      const ws = new WebSocket("ws://localhost");
      const tags = url.searchParams.getAll("tag");
      this.state.acceptWebSocket(ws, tags);
      return new Response("Connected");
    }
    if (url.pathname === "/broadcast") {
      const tag = url.searchParams.get("tag") || undefined;
      const sockets = this.state.getWebSockets(tag);
      return new Response(JSON.stringify({ count: sockets.length }));
    }
    return new Response("Not Found", { status: 404 });
  }
}

describe("WebSocket Support", () => {
  it("tracks connected websockets", async () => {
    const registry = new OpenDORegistry();
    const doInstance = await registry.get("ws-test-1", WebSocketDO);

    await doInstance.fetch(new Request("https://do/connect"));
    await doInstance.fetch(new Request("https://do/connect"));
    
    // Check total count
    const res = await doInstance.fetch(new Request("https://do/broadcast"));
    const data = await res.json();
    expect(data.count).toBe(2);
  });

  it("filters websockets by tag", async () => {
    const registry = new OpenDORegistry();
    const doInstance = await registry.get("ws-test-2", WebSocketDO);

    // Connect with tags
    await doInstance.fetch(new Request("https://do/connect?tag=room-a"));
    await doInstance.fetch(new Request("https://do/connect?tag=room-b"));
    await doInstance.fetch(new Request("https://do/connect?tag=room-a&tag=admin"));

    // Check room-a (should be 2)
    const resA = await doInstance.fetch(new Request("https://do/broadcast?tag=room-a"));
    expect((await resA.json()).count).toBe(2);

    // Check room-b (should be 1)
    const resB = await doInstance.fetch(new Request("https://do/broadcast?tag=room-b"));
    expect((await resB.json()).count).toBe(1);

    // Check admin (should be 1)
    const resAdmin = await doInstance.fetch(new Request("https://do/broadcast?tag=admin"));
    expect((await resAdmin.json()).count).toBe(1);
    
    // Check nonexistent tag (should be 0)
    const resNone = await doInstance.fetch(new Request("https://do/broadcast?tag=missing"));
    expect((await resNone.json()).count).toBe(0);
  });
  
  it("automatically removes closed sockets", async () => {
    const registry = new OpenDORegistry();
    const doInstance = await registry.get("ws-test-3", WebSocketDO);

    // Add a socket manually to access it for closing
    const ws = new WebSocket("ws://localhost");
    doInstance.state.acceptWebSocket(ws, ["test"]);
    
    // Verify it's there
    let sockets = doInstance.state.getWebSockets("test");
    expect(sockets.length).toBe(1);

    // Simulate close
    ws.close();
    
    // allow event loop to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Verify it's gone
    sockets = doInstance.state.getWebSockets("test");
    expect(sockets.length).toBe(0);
  });
});
