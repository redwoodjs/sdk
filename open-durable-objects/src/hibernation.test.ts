import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { OpenDurableObjectRegistry } from "./registry.js";
import { OpenDurableObject, DurableObjectState } from "./durable-object/index.js";

class MockWebSocket {
  listeners = new Map<string, Set<Function>>();

  addEventListener(type: string, handler: Function) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  dispatchEvent(event: any) {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        handler(event);
      }
    }
  }

  send(data: any) {
      // no-op
  }
  
  close() {
      // no-op
  }
}

global.WebSocket = MockWebSocket as any;

class MessageEvent {
    type: string;
    data: any;
    constructor(type: string, init: any) {
        this.type = type;
        this.data = init.data;
    }
}
global.MessageEvent = MessageEvent as any;

global.Event = class Event {
    type: string;
    constructor(type: string) { this.type = type; }
} as any;

describe("Improved Hibernation", () => {
  let registry: OpenDurableObjectRegistry;
  
  // Helper to wait
  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  class SimpleDO extends OpenDurableObject {
    constructor(state: DurableObjectState, env: any) {
      super(state, env);
    }
    
    async fetch(request: Request): Promise<Response> {
        return new Response("OK");
    }
  }

  class HibernatingDO extends OpenDurableObject {
    lastMessage: string = "";
    constructor(state: DurableObjectState, env: any) {
      super(state, env);
    }
    
    async fetch(request: Request): Promise<Response> {
        return new Response("OK");
    }

    async webSocketMessage(ws: WebSocket, message: string) {
        this.lastMessage = message;
        // Echo back
        ws.send("echo:" + message);
    }
  }

  class BlockingDO extends OpenDurableObject {
      constructor(state: DurableObjectState, env: any) {
        super(state, env);
      }
      
      async fetch(request: Request): Promise<Response> {
          // Accept websocket but don't implement handlers
          if (request.headers.get("Upgrade") === "websocket") {
              // @ts-ignore
              return new Response(null, { status: 101, webSocket: null });
          }
          return new Response("OK");
      }
  }

  beforeEach(() => {
    // 100ms timeout, 50ms check interval
    registry = new OpenDurableObjectRegistry({
      hibernationTimeoutMs: 100,
      hibernationCheckIntervalMs: 50,
    });
  });

  afterEach(() => {
     if (registry) registry.close();
  });
  
  it("should evict inactive objects after timeout", async () => {
    const id = "test-eviction-" + Date.now();
    const instance1 = await registry.get(id, SimpleDO);
    
    // Wait > 100ms
    await wait(200);
    
    // Should get a NEW instance
    const instance2 = await registry.get(id, SimpleDO);
    expect(instance1).not.toBe(instance2);
  });

  it("should not evict while active (keep-alive)", async () => {
    const id = "test-keep-alive-" + Date.now();
    const instance1 = await registry.get(id, SimpleDO);
    
    // Wait < 100ms
    await wait(50);
    const instance2 = await registry.get(id, SimpleDO);
    expect(instance1).toBe(instance2);
    
    // Touch it via fetch
    await instance1.fetch(new Request("http://localhost"));
    
    // Wait another 50ms (total > 100ms from start, but < 100ms from fetch)
    await wait(60);
    const instance3 = await registry.get(id, SimpleDO);
    expect(instance1).toBe(instance3);
  });

  it("should not evict if waitUntil is pending", async () => {
    const id = "test-wait-until-" + Date.now();
    const instance1 = await registry.get(id, SimpleDO);
    
    let resolveWait: () => void;
    const promise = new Promise<void>(r => resolveWait = r);
    instance1.state.waitUntil(promise);
    
    await wait(200);
    
    // Should still be same instance because of waitUntil
    const instance2 = await registry.get(id, SimpleDO);
    expect(instance1).toBe(instance2);
    
    resolveWait!();
    await wait(200); // Now it should evict
    
    const instance3 = await registry.get(id, SimpleDO);
    expect(instance1).not.toBe(instance3);
  });
  
  it("should hibernate with active WebSockets if supported", async () => {
      const id = "test-ws-hibernate-" + Date.now();
      const instance1 = await registry.get(id, HibernatingDO);
      
      const ws = new WebSocket("ws://localhost");
      instance1.state.acceptWebSocket(ws, ["tag"]);
      
      // Wait for eviction
      await wait(250);
      
      // Should be evicted by now
      
      // Send message to wake up
      ws.dispatchEvent(new MessageEvent("message", { data: "hello" }) as any);
      
      // Give it a moment to wake up and process
      await wait(50);
      
      // Now if we get the instance, it should be the one that handled the message
      const instance2 = await registry.get(id, HibernatingDO);
      
      expect(instance1).not.toBe(instance2);
      expect(instance2.lastMessage).toBe("hello");
  });

  it("should NOT hibernate if WebSockets are open but NOT supported", async () => {
      // Use SimpleDO (has no webSocketMessage)
      const id = "test-ws-blocking-" + Date.now();
      const instance1 = await registry.get(id, SimpleDO);
      
      const ws = new WebSocket("ws://localhost");
      instance1.state.acceptWebSocket(ws);
      
      await wait(250);
      
      // Should NOT be evicted
      const instance2 = await registry.get(id, SimpleDO);
      expect(instance1).toBe(instance2);
      
      // Close socket
      ws.close();
      ws.dispatchEvent(new Event("close"));
      
      await wait(250);
      
      // Now should be evicted
      const instance3 = await registry.get(id, SimpleDO);
      expect(instance1).not.toBe(instance3);
  });
});
