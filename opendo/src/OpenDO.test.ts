import { describe, it, expect, vi } from "vitest";
import { OpenDO } from "./OpenDO.js";
import { OpenDORegistry as Registry } from "./Registry.js";
import { encodeEnvelope, decodeEnvelope, RpcEnvelope } from "./Envelope.js";
import { createStub, Connection } from "./RPC.js";

class CounterDO extends OpenDO {
  count = 0;
  constructor(id: string) {
    super(id);
  }
  async handleRequest(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/increment") {
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.count++;
      return new Response(this.count.toString());
    }
    return new Response(this.count.toString());
  }
}

describe("OpenDO Serial Execution", () => {
  it("should process requests serially", async () => {
    const counter = new CounterDO("test");
    
    const requests = Array.from({ length: 5 }, () => 
      counter.fetch(new Request("http://localhost/increment"))
    );
    
    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.text()));
    
    expect(results).toEqual(["1", "2", "3", "4", "5"]);
    expect(counter.count).toBe(5);
  });
});

describe("Registry Singleton Lock", () => {
  it("should reuse instances for the same ID even when requested simultaneously", async () => {
    const registry = new Registry();
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
        // Return a mocked response: serialized result of "42"
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
