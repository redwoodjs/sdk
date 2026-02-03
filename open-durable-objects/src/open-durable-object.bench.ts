import { bench } from "vitest";
import { OpenDurableObject, ClusterCoordinator as OpenDurableObjectRegistry, route } from "./index.js";
import path from "node:path";
import fs from "node:fs";

// Setup
const STORAGE_DIR = path.join(process.cwd(), ".bench-storage");
const registry = new OpenDurableObjectRegistry({ storageDir: STORAGE_DIR });

class BenchmarkDO extends OpenDurableObject {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/kv") {
        await this.storage.put("foo", "bar");
        await this.storage.get("foo");
        return new Response("OK");
    }
    if (url.pathname === "/sql") {
        this.storage.sql.exec("CREATE TABLE IF NOT EXISTS bench (id INTEGER PRIMARY KEY)");
        this.storage.sql.exec("INSERT INTO bench DEFAULT VALUES");
        return new Response("OK");
    }
    return new Response("Hello World");
  }
}

// Cleanup
if (fs.existsSync(STORAGE_DIR)) {
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
}

// Benchmark: Registry.get (Cached)
const cachedId = "cached-instance";
// Pre-warm
await registry.get(cachedId, BenchmarkDO);

bench(
  "Registry.get (Cached)",
  async () => {
    await registry.get(cachedId, BenchmarkDO);
  },
  { time: 1000 }
);

// Benchmark: Registry.get (New)
let newIdCounter = 0;
bench(
  "Registry.get (New)",
  async () => {
    const id = `new-${++newIdCounter}`;
    await registry.get(id, BenchmarkDO);
  },
  { time: 1000 }
);

// Benchmark: Instance Execution (No Op)
const noOpId = "noop-instance";
const noOpInstance = await registry.get(noOpId, BenchmarkDO);
const noOpRequest = new Request("http://localhost/");

bench(
  "Instance.fetch (No Op)",
  async () => {
    await noOpInstance.fetch(noOpRequest);
  },
  { time: 1000 }
);

// Benchmark: Instance Execution (KV)
const kvId = "kv-instance";
const kvInstance = await registry.get(kvId, BenchmarkDO);
const kvRequest = new Request("http://localhost/kv");

bench(
  "Instance.fetch (KV Read/Write)",
  async () => {
    await kvInstance.fetch(kvRequest);
  },
  { time: 1000 }
);

// Benchmark: Instance Execution (SQL)
const sqlId = "sql-instance";
const sqlInstance = await registry.get(sqlId, BenchmarkDO);
const sqlRequest = new Request("http://localhost/sql");

bench(
  "Instance.fetch (SQL Write)",
  async () => {
    await sqlInstance.fetch(sqlRequest);
  },
  { time: 1000 }
);

// Benchmark: list()
const listId = "list-instance";
const listInstance = await registry.get(listId, BenchmarkDO);
// Populate with 100 items
const listEntries: Record<string, string> = {};
for (let i = 0; i < 100; i++) {
    listEntries[`key-${i.toString().padStart(3, '0')}`] = `value-${i}`;
}
await listInstance.storage.put(listEntries);

bench(
    "Storage.list (100 items)",
    async () => {
        await listInstance.storage.list({ limit: 100 });
    },
    { time: 1000 }
);

// Benchmark: Router
const router = route(registry, BenchmarkDO, (req: Request) => {
    const url = new URL(req.url);
    // Simple extraction
    return url.searchParams.get("id");
});

// Pre-warm router target
const routerTargetId = "router-target";
await registry.get(routerTargetId, BenchmarkDO);
const routerRequest = new Request(`http://localhost/?id=${routerTargetId}`);

bench(
  "Router Dispatch",
  async () => {
    await router(routerRequest);
  },
  { time: 1000 }
);

// Cleanup hook - Note: Vitest doesn't have a global teardown for bench easily accessible in the file alone, 
// so we might leave some artifacts. But we clean at start.
