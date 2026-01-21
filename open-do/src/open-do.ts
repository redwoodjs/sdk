export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  put<T = unknown>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  list<T = unknown>(options?: { start?: string; end?: string; prefix?: string; reverse?: boolean; limit?: number }): Promise<Map<string, T>>;
}

export interface DurableObjectState {
  id: string;
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  waitUntil(promise: Promise<any>): void;
}

export abstract class OpenDO {
  #queue = Promise.resolve<any>(undefined);
  #state: DurableObjectState;
  #env: any;

  constructor(state: DurableObjectState, env: any) {
    this.#state = state;
    this.#env = env;
  }

  get id() {
    return this.#state.id;
  }

  get state() {
    return this.#state;
  }

  /**
   * Internal wrapper to ensure serial execution.
   * In a real CF worker, the system handles lifecycle, but here we wrap 'fetch'.
   */
  async _internalFetch(request: Request): Promise<Response> {
    return (this.#queue = this.#queue.then(async () => {
      try {
        return await this.fetch(request);
      } catch (error) {
        return new Response(
          error instanceof Error ? error.message : "Internal Server Error",
          { status: 500 }
        );
      }
    }));
  }

  /**
   * The actual method implemented by the user, matching Cloudflare's API.
   */
  abstract fetch(request: Request): Response | Promise<Response>;
}
