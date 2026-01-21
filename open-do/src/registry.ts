import {
  OpenDO,
  DurableObjectState,
  DurableObjectStorage,
  DurableObjectSql,
  DurableObjectSqlStatement,
} from "./open-do.js";
import path from "node:path";
import fs from "node:fs";
import { serialize, deserialize } from "node:v8";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isBun = typeof Bun !== "undefined";

/**
 * Cross-runtime serialization
 */
function fastSerialize(value: any): Buffer | Uint8Array {
  if (isBun) {
    // @ts-ignore
    return Bun.serialize(value);
  }
  return serialize(value);
}

function fastDeserialize(value: Buffer | Uint8Array): any {
  if (isBun) {
    // @ts-ignore
    return Bun.deserialize(value);
  }
  return deserialize(value);
}

/**
 * Native SQLite Driver Discovery
 */
async function getSqliteDriver(): Promise<any> {
  if (isBun) {
    // @ts-ignore
    return (await import("bun:sqlite")).Database;
  }

  try {
    const sqlite = require("node:sqlite");
    if (sqlite.DatabaseSync) {
      return sqlite.DatabaseSync;
    }
    throw new Error("node:sqlite found, but DatabaseSync is missing.");
  } catch (e: any) {
    const isNode = typeof process !== "undefined" && process.versions?.node;
    if (isNode) {
      const nodeVersion = process.versions.node;
      const [major, minor] = nodeVersion.split(".").map(Number);
      if (major < 22 || (major === 22 && minor < 5)) {
        throw new Error(
          `OpenDO Persistence Error: node:sqlite is not available in Node.js ${nodeVersion}. Please upgrade to v22.5.0 or later.`
        );
      }
      throw new Error(
        `OpenDO Persistence Error: node:sqlite is missing (Error: ${e.message}). If you are using Node.js, ensure you run with the '--experimental-sqlite' flag.`
      );
    }
    throw new Error(
      "OpenDO Persistence Error: Persistent storage is not supported in this runtime. Currently only Bun and Node.js (v22.5+) are supported."
    );
  }
}

class SqliteStorage implements DurableObjectStorage {
  #db: any;
  sql: DurableObjectSql;

  constructor(db: any) {
    this.#db = db;
    this.#db.exec(`
      CREATE TABLE IF NOT EXISTS _kv (
        key TEXT PRIMARY KEY,
        value BLOB
      );
      CREATE TABLE IF NOT EXISTS _alarms (
        scheduledTime INTEGER PRIMARY KEY
      );
    `);

    const dbInstance = this.#db;

    this.sql = {
      prepare(query: string): DurableObjectSqlStatement {
        const stmt = dbInstance.prepare(query);
        let _bindings: any[] = [];

        return {
          bind(...params: any[]) {
            _bindings = params;
            return this;
          },
          first<T = unknown>() {
            return stmt.get(..._bindings) as T;
          },
          all<T = unknown>() {
            return stmt.all(..._bindings) as T[];
          },
          run() {
            const result = stmt.run(..._bindings);
            return {
              changes: result.changes,
              lastInsertRowid: result.lastInsertRowid,
            };
          },
        };
      },
      exec(query: string) {
        dbInstance.exec(query);
      },
      get databaseSize(): number {
        const pageCount = dbInstance.prepare("PRAGMA page_count").get() as any;
        const pageSize = dbInstance.prepare("PRAGMA page_size").get() as any;
        // The return structure differs slightly between Bun and Node
        const count = typeof pageCount === "number" ? pageCount : Object.values(pageCount)[0] as number;
        const size = typeof pageSize === "number" ? pageSize : Object.values(pageSize)[0] as number;
        return count * size;
      },
    };
  }

  async get<T = unknown>(key: string | string[]): Promise<any> {
    if (Array.isArray(key)) {
      const results = new Map<string, T>();
      const stmt = this.#db.prepare("SELECT key, value FROM _kv WHERE key = ?");
      for (const k of key) {
        const row = stmt.get(k);
        if (row) results.set(k, fastDeserialize(row.value));
      }
      return results;
    }

    const row = this.#db.prepare("SELECT value FROM _kv WHERE key = ?").get(key);
    return row ? fastDeserialize(row.value) : undefined;
  }

  async put<T = unknown>(
    key: string | Record<string, T>,
    value?: T
  ): Promise<void> {
    const stmt = this.#db.prepare(
      "INSERT OR REPLACE INTO _kv (key, value) VALUES (?, ?)"
    );
    if (typeof key === "string") {
      stmt.run(key, fastSerialize(value));
    } else {
      for (const [k, v] of Object.entries(key)) {
        stmt.run(k, fastSerialize(v));
      }
    }
  }

  async delete(key: string | string[]): Promise<any> {
    if (Array.isArray(key)) {
      const stmt = this.#db.prepare("DELETE FROM _kv WHERE key = ?");
      let count = 0;
      for (const k of key) {
        const result = stmt.run(k);
        if (result.changes > 0) count++;
      }
      return count;
    }

    const result = this.#db.prepare("DELETE FROM _kv WHERE key = ?").run(key);
    return result.changes > 0;
  }

  async deleteAll(): Promise<void> {
    this.#db.exec("DELETE FROM _kv");
  }

  async list<T = unknown>(options?: any): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    let query = "SELECT key, value FROM _kv";
    const params: any[] = [];
    const wheres: string[] = [];

    if (options?.prefix) {
      wheres.push("key LIKE ?");
      params.push(`${options.prefix}%`);
    }

    if (options?.start) {
      wheres.push("key >= ?");
      params.push(options.start);
    }

    if (options?.startAfter) {
      wheres.push("key > ?");
      params.push(options.startAfter);
    }

    if (options?.end) {
      wheres.push("key < ?");
      params.push(options.end);
    }

    if (wheres.length > 0) {
      query += " WHERE " + wheres.join(" AND ");
    }

    query += " ORDER BY key " + (options?.reverse ? "DESC" : "ASC");

    if (options?.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    const rows = this.#db.prepare(query).all(...params);
    for (const row of rows) {
      results.set(row.key, fastDeserialize(row.value));
    }
    return results;
  }

  async getAlarm(): Promise<number | null> {
    const row = this.#db.prepare("SELECT scheduledTime FROM _alarms LIMIT 1").get();
    return row ? Number(row.scheduledTime) : null;
  }

  async setAlarm(scheduledTime: number | Date): Promise<void> {
    const time = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
    this.#db.exec("DELETE FROM _alarms");
    this.#db.prepare("INSERT INTO _alarms (scheduledTime) VALUES (?)").run(BigInt(time));
  }

  async deleteAlarm(): Promise<void> {
    this.#db.exec("DELETE FROM _alarms");
  }

  async sync(): Promise<void> {
    // No-op for local SQLite
  }

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    this.#db.exec("BEGIN");
    try {
      const result = await callback();
      this.#db.exec("COMMIT");
      return result;
    } catch (error) {
      this.#db.exec("ROLLBACK");
      throw error;
    }
  }
}

class InMemoryStorage implements DurableObjectStorage {
  #data = new Map<string, any>();

  sql: DurableObjectSql = {
    prepare: () => {
      throw new Error("SQL API is not supported in InMemoryStorage");
    },
    exec: () => {
      throw new Error("SQL API is not supported in InMemoryStorage");
    },
    get databaseSize(): number {
      return 0;
    },
  };

  async get<T = unknown>(key: string | string[]): Promise<any> {
    if (Array.isArray(key)) {
      const results = new Map<string, T>();
      for (const k of key) {
        if (this.#data.has(k)) results.set(k, this.#data.get(k));
      }
      return results;
    }
    return this.#data.get(key);
  }

  async put<T = unknown>(
    key: string | Record<string, T>,
    value?: T
  ): Promise<void> {
    if (typeof key === "string") {
      this.#data.set(key, value);
    } else {
      for (const [k, v] of Object.entries(key)) {
        this.#data.set(k, v);
      }
    }
  }

  async delete(key: string | string[]): Promise<any> {
    if (Array.isArray(key)) {
      let count = 0;
      for (const k of key) {
        if (this.#data.delete(k)) count++;
      }
      return count;
    }
    return this.#data.delete(key);
  }

  async deleteAll(): Promise<void> {
    this.#data.clear();
  }

  async list<T = unknown>(options?: any): Promise<Map<string, T>> {
    let entries = Array.from(this.#data.entries());

    if (options?.prefix) {
      entries = entries.filter(([k]) => k.startsWith(options.prefix));
    }

    if (options?.start) {
      entries = entries.filter(([k]) => k >= options.start);
    }

    if (options?.startAfter) {
      entries = entries.filter(([k]) => k > options.startAfter);
    }

    if (options?.end) {
      entries = entries.filter(([k]) => k < options.end);
    }

    entries.sort((a, b) => (options?.reverse ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])));

    if (options?.limit) {
      entries = entries.slice(0, options.limit);
    }

    return new Map(entries as any);
  }

  #alarmTime: number | null = null;

  async getAlarm(): Promise<number | null> {
    return this.#alarmTime;
  }

  async setAlarm(scheduledTime: number | Date): Promise<void> {
    this.#alarmTime = scheduledTime instanceof Date ? scheduledTime.getTime() : scheduledTime;
  }

  async deleteAlarm(): Promise<void> {
    this.#alarmTime = null;
  }

  async sync(): Promise<void> {}

  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // InMemoryStorage doesn't easily support rollbacks without snapshots.
    // Given the single-threaded nature of DOs, we just run it.
    // If it fails, some state might have been changed before failure.
    return await callback();
  }
}

class DurableObjectStateImpl implements DurableObjectState {
  id: string;
  storage: DurableObjectStorage;
  #queue = Promise.resolve<any>(undefined);
  #instance: OpenDO | null = null;
  #websockets = new Set<{ ws: WebSocket; tags: Set<string> }>();

  constructor(id: string, storage: DurableObjectStorage) {
    this.id = id;
    this.storage = storage;
  }

  _setInstance(instance: OpenDO) {
    this.#instance = instance;
  }

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return (this.#queue = this.#queue.then(callback));
  }

  waitUntil(promise: Promise<any>): void {
    if (this.#instance) {
      this.#instance._addWaitUntil(promise);
    }
  }

  acceptWebSocket(ws: WebSocket, tags: string[] = []): void {
    // Cloudflare's API requires calling accept() on the server side
    // We assume the user might have already called it, but safe to call again if needed?
    // Actually, DOs call state.acceptWebSocket(ws). The doc says:
    // "Accepts the WebSocket connection... If the WebSocket was not already accepted, it is accepted."
    // In many envs (like Bun), strict accept() is needed.
    // However, here we primarily track it.
    
    // Check if we need to call accept(). 
    // If it's a standard WebSocket, it might already be open or in connecting state.
    // We'll rely on the user or the framework having handled the upgrade, 
    // but we ensure it's tracked.
    
    const entry = { ws, tags: new Set(tags) };
    this.#websockets.add(entry);

    // Auto-cleanup on close
    ws.addEventListener("close", () => {
      this.#websockets.delete(entry);
    });
    
    // Handle error as close
    ws.addEventListener("error", () => {
       this.#websockets.delete(entry);
    });
  }

  getWebSockets(tag?: string): WebSocket[] {
    const sockets: WebSocket[] = [];
    for (const entry of this.#websockets) {
      if (!tag || entry.tags.has(tag)) {
        sockets.push(entry.ws);
      }
    }
    return sockets;
  }
}

type OpenDOConstructor<T extends OpenDO> = new (
  state: DurableObjectState,
  env: any
) => T;

export class OpenDORegistry {
  #instances = new Map<string, OpenDO | Promise<OpenDO>>();
  #options: { hibernationTimeoutMs?: number; env?: any; storageDir?: string };

  constructor(
    options: {
      hibernationTimeoutMs?: number;
      env?: any;
      storageDir?: string;
    } = {}
  ) {
    this.#options = options;
  }

  async get<T extends OpenDO>(
    id: string,
    Ctor: OpenDOConstructor<T>
  ): Promise<T> {
    const existing = this.#instances.get(id);
    if (existing) {
      const instance = await existing;
      if (instance instanceof OpenDO) {
        return instance as T;
      }
    }

    const promise = (async () => {
      try {
        let storage: DurableObjectStorage;

        if (this.#options.storageDir) {
          const resolvedDir = path.resolve(process.cwd(), this.#options.storageDir);
          if (!fs.existsSync(resolvedDir)) {
            fs.mkdirSync(resolvedDir, { recursive: true });
          }
          const dbPath = path.join(resolvedDir, `${id}.sqlite`);
          const Driver = await getSqliteDriver();
          const db = new Driver(dbPath);
          storage = new SqliteStorage(db);
        } else {
          storage = new InMemoryStorage();
        }

        let instance: T;
        const state = new DurableObjectStateImpl(id, storage);
        const env = this.#options.env || {};
        instance = new Ctor(state, env);
        state._setInstance(instance);

        // Check for alarms
        const checkAlarm = async () => {
          const alarmTime = await storage.getAlarm();
          if (alarmTime && alarmTime <= Date.now()) {
            await storage.deleteAlarm();
            if (instance.alarm) {
              await instance.alarm();
            }
          }
          if (instance.alarm) {
            // Re-check periodically or use a more sophisticated scheduler
            setTimeout(checkAlarm, 1000);
          }
        };
        checkAlarm();

        return instance;
      } catch (error) {
        this.#instances.delete(id);
        throw error;
      }
    })();

    this.#instances.set(id, promise);
    const instance = await promise;
    this.#instances.set(id, instance);
    return instance as T;
  }
}
