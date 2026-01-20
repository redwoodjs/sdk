import { expect, it, describe, beforeAll } from "vitest";
import { invoke } from "../helpers";
import { env } from "cloudflare:test";

describe("Cloudflare Bindings Integration", () => {
  describe("KV Store", () => {
    it("should set and get values in KV via the bridge", async () => {
      const testKey = "test-key-" + Date.now();
      const testValue = "hello-world";
      
      await invoke("setKVValue", testKey, testValue);
      const result = await invoke("getKVValue", testKey);
      
      expect(result).toBe(testValue);
      
      // Verify directly via env in test (fidelity check)
      const directValue = await env.KV.get(testKey);
      expect(directValue).toBe(testValue);
    });
  });

  describe("D1 Database", () => {
    beforeAll(async () => {
      await invoke("initDatabase");
    });

    it("should insert record and retrieve it via the bridge", async () => {
      const itemName = "Test Item " + Date.now();
      
      const id = await invoke<number>("addItem", itemName);
      expect(id).toBeGreaterThan(0);
      
      const items = await invoke<any[]>("getItems");
      expect(items).toContainEqual(expect.objectContaining({
        id,
        name: itemName
      }));
      
      // Verify directly via env in test (fidelity check)
      const { results } = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(id).all();
      expect(results[0]).toMatchObject({ id, name: itemName });
    });
  });
});
