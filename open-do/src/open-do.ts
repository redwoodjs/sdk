export interface DurableObjectStorage {
  get<T = unknown>(key: string): Promise<T | undefined>;
  get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  put<T = unknown>(key: string, value: T): Promise<void>;
  put<T = unknown>(entries: Record<string, T>): Promise<void>;
  delete(key: string): Promise<boolean>;
  delete(keys: string[]): Promise<number>;
  deleteAll(): Promise<void>;
  list<T = unknown>(options?: {
    start?: string;
    startAfter?: string;
    end?: string;
    prefix?: string;
    reverse?: boolean;
    limit?: number;
  }): Promise<Map<string, T>>;
  getAlarm(options?: any): Promise<number | null>;
  setAlarm(scheduledTime: number | Date, options?: any): Promise<void>;
  deleteAlarm(options?: any): Promise<void>;
  sync(): Promise<void>;
  transaction<T>(callback: () => Promise<T>): Promise<T>;
  sql: DurableObjectSql;
}

export interface DurableObjectSql {
  prepare(query: string): DurableObjectSqlStatement;
  exec(query: string): void;
  readonly databaseSize: number;
}

export interface DurableObjectSqlStatement {
  bind(...params: any[]): DurableObjectSqlStatement;
  first<T = unknown>(): T | null;
  all<T = unknown>(): T[];
  run(): { changes: number; lastInsertRowid: number | bigint };
}

export interface DurableObjectState {
  id: string;
  storage: DurableObjectStorage;
  blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>;
  waitUntil(promise: Promise<any>): void;
  acceptWebSocket(ws: WebSocket, tags?: string[]): void;
  getWebSockets(tag?: string): WebSocket[];
}

export abstract class OpenDO {
  #state: DurableObjectState;
  #env: any;
  #waitUntilPromises: Promise<any>[] = [];

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

  get ctx() {
    return this.#state;
  }

  get storage() {
    return this.#state.storage;
  }

  /**
   * Internal wrapper to ensure serial execution.
   * In a real CF worker, the system handles lifecycle, but here we wrap 'fetch'.
   */
  async _internalFetch(request: Request): Promise<Response> {
    return this.#state.blockConcurrencyWhile(async () => {
      try {
        return await this.fetch(request);
      } catch (error) {
        return new Response(
          error instanceof Error ? error.message : "Internal Server Error",
          { status: 500 }
        );
      }
    });
  }

  /**
   * The actual method implemented by the user, matching Cloudflare's API.
   */
  abstract fetch(request: Request): Response | Promise<Response>;

  /**
   * Optional alarm handler.
   */
  async alarm?(): Promise<void>;

  /**
   * Internal method to wait for all background tasks.
   * Useful for testing or ensuring graceful shutdown.
   */
  async _waitForWaitUntil(): Promise<void> {
    while (this.#waitUntilPromises.length > 0) {
      const promises = [...this.#waitUntilPromises];
      this.#waitUntilPromises = [];
      await Promise.all(promises);
    }
  }

  /**
   * @internal
   */
  _addWaitUntil(promise: Promise<any>): void {
    this.#waitUntilPromises.push(promise);
  }
}
