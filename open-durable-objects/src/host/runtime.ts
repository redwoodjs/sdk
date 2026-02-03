import {
  OpenDurableObject,
  DurableObjectState,
  DurableObjectStorage,
} from "../durable-object/index.js";

export class InstanceContainer {
  id: string;
  storage: DurableObjectStorage;
  env: any;
  instance: OpenDurableObject | null = null;
  
  #state: DurableObjectStateImpl | null = null;
  #loadingPromise: Promise<OpenDurableObject> | null = null;
  #Ctor: OpenDOConstructor<any> | null = null;
  #supportsHibernation = false;

  #activeRequests = 0;
  #lastActive = Date.now();
  #waitUntilPromises = new Set<Promise<any>>();
  #webSockets = new Set<{ ws: WebSocket; tags: Set<string> }>();
  
  #alarmCheckTimer: any = null;

  constructor(id: string, storage: DurableObjectStorage, env: any) {
    this.id = id;
    this.storage = storage;
    this.env = env;
  }

  touch() {
    this.#lastActive = Date.now();
  }

  async getInstance(Ctor?: OpenDOConstructor<any>): Promise<OpenDurableObject> {
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
  
  async executeFetch(request: Request, instance: OpenDurableObject): Promise<Response> {
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
  
  #startAlarmCheck(instance: OpenDurableObject) {
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
  }
  
  get isEmpty() {
      // True if we have no state that needs to be kept in memory
      // i.e. no instance, no websockets, no pending promises.
      return !this.instance && this.#webSockets.size === 0 && this.#waitUntilPromises.size === 0 && this.#activeRequests === 0;
  }
}

export class DurableObjectStateImpl implements DurableObjectState {
  #container: InstanceContainer;
  #queue = Promise.resolve<any>(undefined);
  #instance: OpenDurableObject | null = null;
  
  // Proxy id to container
  get id() { return this.#container.id; } 

  constructor(container: InstanceContainer, public storage: DurableObjectStorage) {
    this.#container = container;
  }

  _setInstance(instance: OpenDurableObject) {
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

export type OpenDOConstructor<T extends OpenDurableObject> = new (
  state: DurableObjectState,
  env: any
) => T;
