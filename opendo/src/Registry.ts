import { OpenDO } from "./OpenDO.js";

type OpenDOConstructor<T extends OpenDO> = new (id: string) => T;

export class OpenDORegistry {
  #instances = new Map<string, OpenDO | Promise<OpenDO>>();
  #options: { hibernationTimeoutMs?: number };

  constructor(options: { hibernationTimeoutMs?: number } = {}) {
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
        // Update last access if we had a hibernation mechanism (not implemented here for brevity, but could be added)
        return instance as T;
      }
    }

    const promise = (async () => {
      try {
        const instance = new Ctor(id);
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
