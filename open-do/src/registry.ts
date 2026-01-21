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

class InstanceContainer {
  id: string;
  storage: DurableObjectStorage;
  env: any;
  instance: OpenDO | null = null;
  
  #state: DurableObjectStateImpl | null = null;
  #loadingPromise: Promise<OpenDO> | null = null;
  #Ctor: OpenDOConstructor<any> | null = null;
  #supportsHibernation = false;

  #activeRequests = 0;
  #lastActive = Date.now();
  #waitUntilPromises = new Set<Promise<any>>();
  #webSockets = new Set<{ ws: WebSocket; tags: Set<string> }>();
  
  #alarmCheckTimer: any = null;
  #registry: OpenDORegistry;

  constructor(registry: OpenDORegistry, id: string, storage: DurableObjectStorage, env: any) {
    this.#registry = registry;
    this.id = id;
    this.storage = storage;
    this.env = env;
  }

  touch() {
    this.#lastActive = Date.now();
  }

  async getInstance(Ctor?: OpenDOConstructor<any>): Promise<OpenDO> {
    this.touch();
    if (this.instance) return this.instance;
    if (this.#loadingPromise) return this.#loadingPromise;
    
    // If we are waking up from hibernation/eviction without a direct Ctor call (e.g. WS message),
    // we must have the Ctor cached.
    if (!Ctor) {
        if (this.#Ctor) Ctor = this.#Ctor;
        else throw new Error(`Cannot wake up Durable Object ${this.id}: Constructor not found.`);
    } else {
        this.#Ctor = Ctor;
    }

    const FinalCtor = Ctor!;

    this.#loadingPromise = (async () => {
      await Promise.resolve(); // Ensure async execution so assignment happens first
      try {
        const state = new DurableObjectStateImpl(this, this.storage);
        this.#state = state;
        const instance = new FinalCtor(state, this.env);
        this.instance = instance;
        state._setInstance(instance);
        
        // Detect hibernation support
        this.#supportsHibernation = typeof instance.webSocketMessage === 'function';
        
        this.#startAlarmCheck(instance);

        return instance;
      } catch (e) {
        // If construction triggers error, we fail
        throw e;
      } finally {
        this.#loadingPromise = null;
      }
    })();

    return this.#loadingPromise;
  }
  
  async executeFetch(request: Request, instance: OpenDO): Promise<Response> {
    this.#activeRequests++;
    this.touch();
    try {
      return await instance._internalFetch(request);
    } finally {
      this.#activeRequests--;
      this.touch();
    }
  }

  addWaitUntil(promise: Promise<any>) {
    this.#waitUntilPromises.add(promise);
    this.touch();
    promise.catch(e => console.error("WaitUntil Error:", e)).finally(() => {
        this.#waitUntilPromises.delete(promise);
        this.touch();
    });
  }
  
  acceptWebSocket(ws: WebSocket, tags: string[]) {
    this.touch();
    const entry = { ws, tags: new Set(tags) };
    this.#webSockets.add(entry);
    
    // Cleanup on close
    const cleanup = () => {
      this.#webSockets.delete(entry);
      this.touch();
    };
    ws.addEventListener("close", cleanup);
    ws.addEventListener("error", cleanup);
    
    // Setup Hibernation Handlers
    // We attach these listeners ONCE. If we are hibernated, the listeners stay on the WS.
    // When they fire, we wake up.
    
    ws.addEventListener("message", async (event) => {
        this.touch();
        // Only handle if hibernation is supported or if instance is active?
        // If hibernation is NOT supported, the user handles the WS themselves, so we shouldn't interfere?
        // ACTUALLY: The "Hibernation API" replaces the user's standard listeners.
        // If `webSocketMessage` is defined, we use it.
        // We can check `this.#supportsHibernation` but that might not be set if we haven't loaded yet?
        // But `acceptWebSocket` is called FROM the instance, so we MUST have loaded.
        
        if (this.#supportsHibernation) {
            const instance = await this.getInstance();
            if (instance.webSocketMessage) {
                 await instance.webSocketMessage(ws, event.data);
            }
        }
    });

    ws.addEventListener("close", async (event) => {
        this.touch();
        if (this.#supportsHibernation) {
            // We might need to wake up just to handle close?
             const instance = await this.getInstance();
             if (instance.webSocketClose) {
                 await instance.webSocketClose(ws, event.code, event.reason, event.wasClean);
             }
        }
    });

    ws.addEventListener("error", async (event) => {
        this.touch();
        if (this.#supportsHibernation) {
             const instance = await this.getInstance();
             if (instance.webSocketError) {
                 // @ts-ignore
                 await instance.webSocketError(ws, event);
             }
        }
    });
  }
  
  getWebSockets(tag?: string): WebSocket[] {
    const sockets: WebSocket[] = [];
    for (const entry of this.#webSockets) {
      if (!tag || entry.tags.has(tag)) {
        sockets.push(entry.ws);
      }
    }
    return sockets;
  }
  
  #startAlarmCheck(instance: OpenDO) {
      if (this.#alarmCheckTimer) return; // Already running
      
      const check = async () => {
          if (!this.instance) {
              // If evicted, stop checking? 
              // No, we technically need to check alarm to wake up.
              // But for now, let's assume if we are evicted, the Registry handles waking us up?
              // The Registry implementation had a loop inside `get()`.
              // We should probably rely on the container to check alarms if it's active.
              // If it's evicted, we need a way to check alarms WITHOUT loading.
              // Storing 'nextAlarm' in memory?
              // Optimization: When evicting, read next alarm time.
              this.#alarmCheckTimer = null;
              return; 
          }
          
          try {
            const alarmTime = await this.storage.getAlarm();
            if (alarmTime && alarmTime <= Date.now()) {
                await this.storage.deleteAlarm();
                if (instance.alarm) {
                    this.touch();
                    await instance.alarm();
                }
            }
          } catch (e) {
              console.error("Alarm check error", e);
          }
          
          this.#alarmCheckTimer = setTimeout(check, 1000);
      };
      
      check();
  }

  canEvict(timeout: number): boolean {
      const age = Date.now() - this.#lastActive;
      if (age < timeout) return false;
      if (this.#activeRequests > 0) return false;
      if (this.#waitUntilPromises.size > 0) return false;
      
      if (this.#webSockets.size > 0) {
          // Can only evict if hibernation is supported
          if (!this.#supportsHibernation) return false;
      }
      
      return true;
  }
  
  async evict() {
      // Clear instance reference
      this.instance = null;
      this.#state = null;
      // Stop internal alarm loop (we'll restart it on wake)
      if (this.#alarmCheckTimer) {
          clearTimeout(this.#alarmCheckTimer);
          this.#alarmCheckTimer = null;
      }
      // Note: We keeping the Container alive in the Registry if there are WebSockets?
      // Or do we rely on the implementation?
      // If we evict the container from the Registry map, we lose the WebSockets!
      // So Registry should NOT delete the Container if activeWebSockets > 0, 
      // but the Container can delete its `instance`.
  }
  
  get isEmpty() {
      // True if we have no state that needs to be kept in memory
      // i.e. no instance, no websockets, no pending promises.
      return !this.instance && this.#webSockets.size === 0 && this.#waitUntilPromises.size === 0 && this.#activeRequests === 0;
  }
}

class DurableObjectStateImpl implements DurableObjectState {
  #container: InstanceContainer;
  #queue = Promise.resolve<any>(undefined);
  #instance: OpenDO | null = null;
  
  // Proxy id to container
  get id() { return this.#container.id; } 

  constructor(container: InstanceContainer, public storage: DurableObjectStorage) {
    this.#container = container;
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
      this.#container.addWaitUntil(promise);
    }
  }

  acceptWebSocket(ws: WebSocket, tags: string[] = []): void {
      this.#container.acceptWebSocket(ws, tags);
  }

  getWebSockets(tag?: string): WebSocket[] {
      return this.#container.getWebSockets(tag);
  }
}

type OpenDOConstructor<T extends OpenDO> = new (
  state: DurableObjectState,
  env: any
) => T;

export class OpenDORegistry {
  #containers = new Map<string, InstanceContainer>();
  #options: { 
      hibernationTimeoutMs?: number; 
      hibernationCheckIntervalMs?: number;
      env?: any; 
      storageDir?: string 
  };
  #evictionInterval: any = null;

  constructor(
    options: {
      hibernationTimeoutMs?: number;
      hibernationCheckIntervalMs?: number;
      env?: any;
      storageDir?: string;
    } = {}
  ) {
    this.#options = options;
    
    // Start eviction loop
    const interval = this.#options.hibernationCheckIntervalMs || 10000;
    if (typeof setInterval !== 'undefined') {
        this.#evictionInterval = setInterval(() => this.#performEviction(), interval);
        if (this.#evictionInterval.unref) this.#evictionInterval.unref();
    }
  }

  async get<T extends OpenDO>(
    id: string,
    Ctor: OpenDOConstructor<T>
  ): Promise<T> {
    let container = this.#containers.get(id);
    if (!container) {
        // Create storage
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

        container = new InstanceContainer(this, id, storage, this.#options.env || {});
        this.#containers.set(id, container);
    }
    
    // Register Ctor in case we need it for wakeup
    return (await container.getInstance(Ctor)) as T;
  }
  
  #performEviction() {
      const timeout = this.#options.hibernationTimeoutMs || 30000;
      for (const [id, container] of this.#containers) {
          if (container.canEvict(timeout)) {
              if (container.instance) {
                  container.evict(); // Unloads instance, keeps container if needed
              }
              
              if (container.isEmpty) {
                  // If container is truly empty (no websockets), remove it entirely
                  this.#containers.delete(id);
              }
          }
      }
  }

  close() {
      if (this.#evictionInterval) {
          clearInterval(this.#evictionInterval);
          this.#evictionInterval = null;
      }
      this.#containers.clear();
  }
}

