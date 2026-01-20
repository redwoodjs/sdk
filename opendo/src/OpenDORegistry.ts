import { OpenDO } from "./OpenDO.js";

type OpenDOConstructor<T extends OpenDO> = new () => T;

export class OpenDORegistry {
  private instances = new Map<string, { instance: OpenDO; lastAccess: number }>();
  private hibernationCheckInterval: any = null;

  constructor(private options: { hibernationTimeoutMs?: number } = {}) {
    this.startHibernationCheck();
  }

  getOrCreateInstance<T extends OpenDO>(
    id: string,
    Ctor: OpenDOConstructor<T>
  ): T {
    const entry = this.instances.get(id);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.instance as T;
    }

    const instance = new Ctor();
    this.instances.set(id, { instance, lastAccess: Date.now() });
    return instance;
  }

  private startHibernationCheck() {
    const timeout = this.options.hibernationTimeoutMs || 1000 * 60 * 5; // 5 minutes default

    this.hibernationCheckInterval = setInterval(() => {
      const now = Date.now();
      for (const [id, entry] of this.instances.entries()) {
        if (now - entry.lastAccess > timeout) {
          this.instances.delete(id);
          console.log(`Open-DO instance ${id} hibernated.`);
        }
      }
    }, 1000 * 30); // Check every 30 seconds
  }

  stop() {
    if (this.hibernationCheckInterval) {
      clearInterval(this.hibernationCheckInterval);
    }
  }
}
