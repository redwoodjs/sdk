import { OpenDO, DurableObjectState, DurableObjectStorage } from "./open-do.js";

class InMemoryStorage implements DurableObjectStorage {
  #data = new Map<string, any>();

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

  async put<T = unknown>(key: string | Record<string, T>, value?: T): Promise<void> {
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
    // Simple implementation
    return new Map(this.#data) as Map<string, T>;
  }
}

type OpenDOConstructor<T extends OpenDO> = new (state: DurableObjectState, env: any) => T;

export class OpenDORegistry {
  #instances = new Map<string, OpenDO | Promise<OpenDO>>();
  #options: { hibernationTimeoutMs?: number; env?: any };

  constructor(options: { hibernationTimeoutMs?: number; env?: any } = {}) {
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
        const storage = new InMemoryStorage();
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
