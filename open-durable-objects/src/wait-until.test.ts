import { describe, it, expect } from "vitest";
import { OpenDurableObject, DurableObjectState } from "./durable-object/index.js";
import { OpenDurableObjectRegistry } from "./registry.js";

class WaitUntilDO extends OpenDurableObject {
  processed = false;

  async fetch(request: Request): Promise<Response> {
    const { searchParams } = new URL(request.url);
    const delay = parseInt(searchParams.get("delay") || "100");

    const promise = new Promise<void>((resolve) => {
      setTimeout(() => {
        this.processed = true;
        resolve();
      }, delay);
    });

    this.ctx.waitUntil(promise);

    return new Response("OK");
  }
}

describe("Durable Object waitUntil", () => {
  it("should not block fetch response and allow waiting for background work", async () => {
    const registry = new OpenDurableObjectRegistry();
    const id = "test-do";
    const instance = await registry.get(id, WaitUntilDO);

    const startTime = Date.now();
    const response = await instance._internalFetch(
      new Request("http://localhost/?delay=200")
    );
    const endTime = Date.now();

    expect(await response.text()).toBe("OK");
    // Fetch should return quickly, way before the 200ms delay
    expect(endTime - startTime).toBeLessThan(100);
    expect(instance.processed).toBe(false);

    // Now wait for background work
    await instance._waitForWaitUntil();
    expect(instance.processed).toBe(true);
  });

  it("should handle multiple waitUntil calls", async () => {
    const registry = new OpenDurableObjectRegistry();
    const id = "test-multi-do";
    const instance = await registry.get(id, WaitUntilDO);

    let count = 0;
    
    // Override fetch for this test
    instance.fetch = async () => {
      instance.ctx.waitUntil(new Promise<void>(r => setTimeout(() => { count++; r(); }, 50)));
      instance.ctx.waitUntil(new Promise<void>(r => setTimeout(() => { count++; r(); }, 100)));
      return new Response("OK");
    };

    await instance._internalFetch(new Request("http://localhost/"));
    expect(count).toBe(0);

    await instance._waitForWaitUntil();
    expect(count).toBe(2);
  });

  it("should handle nested waitUntil calls (waitUntil adding more waitUntil)", async () => {
    const registry = new OpenDurableObjectRegistry();
    const id = "test-nested-do";
    const instance = await registry.get(id, WaitUntilDO);

    let step = 0;
    
    instance.fetch = async () => {
      instance.ctx.waitUntil((async () => {
        await new Promise(r => setTimeout(r, 50));
        step = 1;
        instance.ctx.waitUntil((async () => {
          await new Promise(r => setTimeout(r, 50));
          step = 2;
        })());
      })());
      return new Response("OK");
    };

    await instance._internalFetch(new Request("http://localhost/"));
    expect(step).toBe(0);

    await instance._waitForWaitUntil();
    expect(step).toBe(2);
  });
});
