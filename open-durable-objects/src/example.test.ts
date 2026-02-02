import { describe, it, expect } from "vitest";
import { OpenDurableObjectRegistry as Registry } from "./registry.js";
import { OpenDurableObject, DurableObjectState } from "./durable-object/index.js";

// This looks exactly like a Cloudflare Durable Object
class CloudflareStyleDO extends OpenDurableObject {
  async fetch(request: Request) {
    const { pathname } = new URL(request.url);
    
    if (pathname === "/storage-test") {
      await this.storage.put("hello", "world");
      const val = await this.storage.get("hello");
      return new Response(val as string);
    }

    return new Response("OK");
  }
}

describe("Cloudflare API Compatibility", () => {
  it("should work with a Cloudflare-style class definition", async () => {
    const registry = new Registry();
    const id = "some-id";
    
    // Registry.get should be able to instantiate it
    const instance = await registry.get(id, CloudflareStyleDO);
    
    expect(instance.id).toBe(id);
    
    // It should handle requests via _internalFetch (the wrapper)
    const response = await instance._internalFetch(new Request("http://localhost/storage-test"));
    const text = await response.text();
    
    expect(text).toBe("world");
  });

  it("should provide storage methods matching CF API", async () => {
    const registry = new Registry();
    const instance = await registry.get("test-2", CloudflareStyleDO);
    
    await instance.storage.put({
      "key1": "val1",
      "key2": "val2"
    });
    
    const map = await instance.storage.get(["key1", "key2"]);
    expect(map.get("key1")).toBe("val1");
    expect(map.get("key2")).toBe("val2");
  });
});
