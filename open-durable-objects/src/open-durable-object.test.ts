import { describe, it, expect } from "vitest";
import { OpenDurableObject, DurableObjectState } from "./durable-object/index.js";
import { ClusterCoordinator } from "./coordinator.js";
import { encodeEnvelope, decodeEnvelope, RpcEnvelope } from "./durable-object/envelope.js";
import { createStub, Connection } from "./durable-object/rpc.js";

class CounterDO extends OpenDurableObject {
  count = 0;
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
  }
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/increment") {
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.count++;
      return new Response(this.count.toString());
    }
    return new Response(this.count.toString());
  }
}

describe("OpenDurableObject Serial Execution", () => {
  it("should process requests serially via _internalFetch", async () => {
    const storage: any = {};
    const state: DurableObjectState = {
      id: "test",
      storage,
      blockConcurrencyWhile: (cb) => cb(),
      waitUntil: () => {},
      acceptWebSocket: () => {},
      getWebSockets: () => [],
    };
    const counter = new CounterDO(state, {});
    
    const requests = Array.from({ length: 5 }, () => 
      counter._internalFetch(new Request("http://localhost/increment"))
    );
    
    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.text()));
    
    expect(results).toEqual(["1", "2", "3", "4", "5"]);
    expect(counter.count).toBe(5);
  });
});

describe("Registry Singleton Lock", () => {
  it("should reuse instances for the same ID even when requested simultaneously", async () => {
    const registry = new ClusterCoordinator();
    const id = "room-1";
    
    // Fire two requests simultaneously
    const [p1, p2] = await Promise.all([
      registry.get(id, CounterDO),
      registry.get(id, CounterDO)
    ]);
    
    expect(p1).toBe(p2);
    expect(p1.id).toBe(id);
  });
});

describe("RpcEnvelope Binary Encoding", () => {
  it("should encode and decode correctly", () => {
    const envelope: RpcEnvelope = {
      uniqueId: "test-uuid",
      methodName: "testMethod",
      params: new Uint8Array([1, 2, 3]),
      timestamp: 123456789n
    };
    
    const encoded = encodeEnvelope(envelope);
    const decoded = decodeEnvelope(encoded);
    
    expect(decoded.uniqueId).toBe(envelope.uniqueId);
    expect(decoded.methodName).toBe(envelope.methodName);
    expect(decoded.params).toEqual(envelope.params);
    expect(decoded.timestamp).toBe(envelope.timestamp);
  });
});

describe("RPC createStub", () => {
  it("should intercept method calls and send binary envelope", async () => {
    const sentMessages: Uint8Array[] = [];
    const mockConnection: Connection = {
      send: async (msg) => {
        sentMessages.push(msg);
      },
      receive: async () => {
        // Return a mocked response: serialized "42"
        // (Note: this is currently using JSON stringify in RPC.ts but wrapping in binary)
        const result = new TextEncoder().encode(JSON.stringify(42)); 
        return result;
      }
    };
    
    interface ICounter {
      getValue(a: number): Promise<number>;
    }
    
    const stub = createStub<ICounter>("test-id", mockConnection);
    const result = await stub.getValue(10);
    
    expect(result).toBe(42);
    expect(sentMessages.length).toBe(1);
    
    const decoded = decodeEnvelope(sentMessages[0]);
    expect(decoded.methodName).toBe("getValue");
    // Params should decode back to [[10]] via capnweb/JSON in this version
    expect(JSON.parse(new TextDecoder().decode(decoded.params))).toEqual([[10]]);
  });
});

class BlockingDO extends OpenDurableObject {
  initialized = false;
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    // This should block any fetch() until the promise resolves
    state.blockConcurrencyWhile(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
      this.initialized = true;
    });
  }

  async fetch(_request: Request) {
    return new Response(this.initialized ? "initialized" : "not initialized");
  }
}

describe("blockConcurrencyWhile", () => {
  it("should block fetch until initialization is complete", async () => {
    const registry = new ClusterCoordinator();
    const id = "test-blocking";
    
    const instance = await registry.get(id, BlockingDO);
    
    // If blockConcurrencyWhile works, this fetch should wait for the 100ms timeout
    const response = await instance._internalFetch(new Request("http://localhost/"));
    const text = await response.text();
    
    expect(text).toBe("initialized");
  });

  it("should block multiple subsequent fetches", async () => {
    const registry = new ClusterCoordinator();
    const id = "test-blocking-multiple";
    
    const instance = await registry.get(id, BlockingDO);
    
    const responses = await Promise.all([
      instance._internalFetch(new Request("http://localhost/1")),
      instance._internalFetch(new Request("http://localhost/2")),
      instance._internalFetch(new Request("http://localhost/3")),
    ]);
    
    const texts = await Promise.all(responses.map(r => r.text()));
    expect(texts).toEqual(["initialized", "initialized", "initialized"]);
  });
});
