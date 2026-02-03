import { expect, test, describe, beforeAll, afterAll } from "vitest";
import { OpenDurableObject, DurableObjectState, ClusterCoordinator as Registry } from "./index.js";
import fs from "node:fs";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), ".test-storage-persistence");

class PersistenceDO extends OpenDurableObject {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const key = url.searchParams.get("key");
    const val = url.searchParams.get("val");

    if (request.method === "PUT" && key && val) {
      await this.storage.put(key, val);
      return new Response("OK");
    }

    if (request.method === "GET" && key) {
      const result = await this.storage.get(key);
      return new Response(String(result));
    }

    if (url.pathname === "/sql-write") {
      this.storage.sql.exec("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)");
      this.storage.sql.prepare("INSERT INTO users (name) VALUES (?)").bind("Alice").run();
      return new Response("OK");
    }

    if (url.pathname === "/sql-read") {
      const result = this.storage.sql.prepare("SELECT name FROM users").all();
      return new Response(JSON.stringify(result));
    }

    if (url.pathname === "/sql-size") {
      return new Response(String(this.storage.sql.databaseSize));
    }

    return new Response("Not Found", { status: 404 });
  }
}

describe("SQLite Persistence", () => {
  beforeAll(async () => {
    if (fs.existsSync(STORAGE_DIR)) {
      fs.rmSync(STORAGE_DIR, { recursive: true });
    }
  });

  afterAll(async () => {
    fs.rmSync(STORAGE_DIR, { recursive: true });
  });

  test("should persist KV data across registry re-instantiation", async () => {
    const registry1 = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-1";
    
    const do1 = await registry1.get(id, PersistenceDO);
    await do1.storage.deleteAll(); // Start fresh
    await do1.fetch(new Request(`http://localhost/?key=foo&val=bar`, { method: "PUT" }));

    // Verify it's there
    const res1 = await do1.fetch(new Request(`http://localhost/?key=foo`));
    expect(await res1.text()).toBe("bar");

    // Close/simulate "restart" by creating a new registry instance pointing to the same dir
    const registry2 = new Registry({ storageDir: STORAGE_DIR });
    const do2 = await registry2.get(id, PersistenceDO);

    // Verify it persisted
    const res2 = await do2.fetch(new Request(`http://localhost/?key=foo`));
    expect(await res2.text()).toBe("bar");
    
    // Verify file exists
    expect(fs.existsSync(path.join(STORAGE_DIR, `${id}.sqlite`))).toBe(true);
  });

  test("should support SQL API", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-sql-" + Date.now(); // Fresh id to avoid pollution
    const myDo = await registry.get(id, PersistenceDO);

    await myDo.fetch(new Request("http://localhost/sql-write"));
    const res = await myDo.fetch(new Request("http://localhost/sql-read"));
    const data = await res.json() as any[];
    
    expect(data).toHaveLength(1);
    expect(data[0].name).toBe("Alice");
  });

  test("should support databaseSize", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-size";
    const myDo = await registry.get(id, PersistenceDO);
    
    const res = await myDo.fetch(new Request("http://localhost/sql-size"));
    const size = Number(await res.text());
    expect(size).toBeGreaterThan(0);
  });

  test("should handle complex objects in KV", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-complex";
    const myDo = await registry.get(id, PersistenceDO);
    await myDo.storage.deleteAll();

    const complex = { nested: { arr: [1, 2, 3] }, date: new Date(2025, 0, 1) };
    await myDo.storage.put("complex", complex);

    const retrieved = await myDo.storage.get("complex") as any;
    expect(retrieved.nested.arr).toEqual([1, 2, 3]);
    expect(retrieved.date.getFullYear()).toBe(2025);
  });

  test("should support list with startAfter", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-list";
    const myDo = await registry.get(id, PersistenceDO);
    await myDo.storage.deleteAll();

    await myDo.storage.put({
      "a": 1,
      "b": 2,
      "c": 3
    });

    const list1 = await myDo.storage.list({ startAfter: "a" });
    expect(Array.from(list1.keys())).toEqual(["b", "c"]);

    const list2 = await myDo.storage.list({ startAfter: "b" });
    expect(Array.from(list2.keys())).toEqual(["c"]);

    const list3 = await myDo.storage.list({ startAfter: "c" });
    expect(Array.from(list3.keys())).toEqual([]);
  });

  test("should support deleteAll", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-delete-all";
    const myDo = await registry.get(id, PersistenceDO);
    
    await myDo.storage.put("foo", "bar");
    await myDo.storage.deleteAll();
    
    const val = await myDo.storage.get("foo");
    expect(val).toBeUndefined();
  });

  test("should support transaction with rollback", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "test-transaction";
    const myDo = await registry.get(id, PersistenceDO);
    await myDo.storage.deleteAll();

    try {
      await myDo.storage.transaction(async () => {
        await myDo.storage.put("foo", "bar");
        throw new Error("abort");
      });
    } catch (e) {
      // Expected
    }

    const val = await myDo.storage.get("foo");
    expect(val).toBeUndefined(); // Should have rolled back
  });
});
