import { describe, it, expect, vi } from "vitest";
import { OpenDO } from "./OpenDO.js";
import { OpenDORegistry } from "./OpenDORegistry.js";

class CounterDO extends OpenDO {
  count = 0;
  async handleRequest(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/increment") {
      // Simulate some async work
      await new Promise((resolve) => setTimeout(resolve, 10));
      this.count++;
      return new Response(this.count.toString());
    }
    return new Response(this.count.toString());
  }
}

describe("OpenDO Serial Execution", () => {
  it("should process requests serially", async () => {
    const counter = new CounterDO();
    
    // Fire 5 requests at once
    const requests = Array.from({ length: 5 }, () => 
      counter.fetch(new Request("http://localhost/increment"))
    );
    
    const responses = await Promise.all(requests);
    const results = await Promise.all(responses.map(r => r.text()));
    
    // If they were parallel without race condition protection, 
    // we might get multiple "1"s or "2"s depending on timing.
    // With serial execution, we expect 1, 2, 3, 4, 5.
    expect(results).toEqual(["1", "2", "3", "4", "5"]);
    expect(counter.count).toBe(5);
  });
});

describe("OpenDORegistry", () => {
  it("should reuse instances for the same ID", () => {
    const registry = new OpenDORegistry();
    const id = "room-1";
    
    const instance1 = registry.getOrCreateInstance(id, CounterDO);
    const instance2 = registry.getOrCreateInstance(id, CounterDO);
    
    expect(instance1).toBe(instance2);
    registry.stop();
  });

  it("should hibernate idle instances", async () => {
    vi.useFakeTimers();
    const registry = new OpenDORegistry({ hibernationTimeoutMs: 100 });
    const id = "room-idle";
    
    const instance = registry.getOrCreateInstance(id, CounterDO);
    
    // Advance time beyond timeout
    vi.advanceTimersByTime(1000 * 60); // Registry checks every 30s by default
    
    const newInstance = registry.getOrCreateInstance(id, CounterDO);
    expect(newInstance).not.toBe(instance);
    
    registry.stop();
    vi.useRealTimers();
  });
});
