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
      )
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

  async list<T = unknown>(options?: any): Promise<Map<string, T>> {
    const results = new Map<string, T>();
    let query = "SELECT key, value FROM _kv";
    const params: any[] = [];

    if (options?.prefix) {
      query += " WHERE key LIKE ?";
      params.push(`${options.prefix}%`);
    }

    if (options?.start) {
      query += options.prefix ? " AND" : " WHERE";
      query += " key >= ?";
      params.push(options.start);
    }

    if (options?.end) {
      query += (options.prefix || options.start) ? " AND" : " WHERE";
      query += " key < ?";
      params.push(options.end);
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

  async list<T = unknown>(options?: any): Promise<Map<string, T>> {
    // Simplified list for memory
    return new Map(this.#data) as Map<string, T>;
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

        const state: DurableObjectState = {
          id,
          storage,
          blockConcurrencyWhile: async (cb) => cb(),
          waitUntil: () => {},
        };
        const env = this.#options.env || {};
        const instance = new Ctor(state, env);
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
