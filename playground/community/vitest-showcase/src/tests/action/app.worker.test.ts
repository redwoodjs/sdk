import { expect, it, describe, beforeAll } from "vitest";
import { invoke } from "../helpers";
import { env } from "cloudflare:test";

describe("App Server Functions", () => {
  beforeAll(async () => {
    // Ensure table exists
    await invoke("initDatabase");
  });

  it("should coordinate state between D1 and KV in a single 'use server' function", async () => {
    const itemName = "Complex Item " + Date.now();
    
    // Call the server function via the bridge
    const result = await invoke<{ id: number; totalCount: number }>("trackAndSaveItem", itemName);
    
    expect(result.id).toBeGreaterThan(0);
    expect(result.totalCount).toBeGreaterThan(0);
    
    // Verify high-fidelity state in D1
    const { results } = await env.DB.prepare("SELECT * FROM items WHERE id = ?").bind(result.id).all();
    expect(results[0].name).toBe(itemName);
    
    // Verify high-fidelity state in KV
    const kvCount = await env.KV.get("total_items_saved");
    expect(parseInt(kvCount!)).toBe(result.totalCount);
  });

  it("should return system status with binding availability", async () => {
    const status = await invoke<{ dbAlive: boolean; kvAlive: boolean }>("getSystemStatus");
    expect(status.dbAlive).toBe(true);
    expect(status.kvAlive).toBe(true);
  });
});
