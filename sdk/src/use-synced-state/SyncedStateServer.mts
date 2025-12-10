import { RpcStub, RpcTarget, newWorkersRpcResponse } from "capnweb";
import { DurableObject, DurableObjectStub } from "cloudflare:workers";

export type SyncedStateValue = unknown;

type OnSetHandler = (key: string, value: SyncedStateValue, stub: DurableObjectStub<SyncedStateServer>) => void;
type OnGetHandler = (key: string, value: SyncedStateValue | undefined, stub: DurableObjectStub<SyncedStateServer>) => void;
type OnKeyHandler = (key: string, stub: DurableObjectStub<SyncedStateServer>) => Promise<string>;
type OnSubscribeHandler = (key: string, stub: DurableObjectStub<SyncedStateServer>) => void;
type OnUnsubscribeHandler = (key: string, stub: DurableObjectStub<SyncedStateServer>) => void;

/**
 * Durable Object that keeps shared state for multiple clients and notifies subscribers.
 */
export class SyncedStateServer extends DurableObject {
  static #keyHandler: OnKeyHandler | null = null;
  static #setStateHandler: OnSetHandler | null = null;
  static #getStateHandler: OnGetHandler | null = null;
  static #subscribeHandler: OnSubscribeHandler | null = null;
  static #unsubscribeHandler: OnUnsubscribeHandler | null = null;
  static #namespace: DurableObjectNamespace<SyncedStateServer> | null = null;
  static #durableObjectName: string = "syncedState";
  #stub: DurableObjectStub<SyncedStateServer> | null = null;

  static registerKeyHandler(handler: OnKeyHandler | null): void {
    SyncedStateServer.#keyHandler = handler;
  }

  static getKeyHandler(): OnKeyHandler | null {
    return SyncedStateServer.#keyHandler;
  }

  static registerNamespace(namespace: DurableObjectNamespace<SyncedStateServer>, durableObjectName?: string): void {
    SyncedStateServer.#namespace = namespace;
    if (durableObjectName) {
      SyncedStateServer.#durableObjectName = durableObjectName;
    }
  }

  static getNamespace(): DurableObjectNamespace<SyncedStateServer> | null {
    return SyncedStateServer.#namespace;
  }

  static getDurableObjectName(): string {
    return SyncedStateServer.#durableObjectName;
  }

  setStub(stub: DurableObjectStub<SyncedStateServer>): void {
    this.#stub = stub;
  }

  static registerSetStateHandler(handler: OnSetHandler | null): void {
    SyncedStateServer.#setStateHandler = handler;
  }

  static registerGetStateHandler(handler: OnGetHandler | null): void {
    SyncedStateServer.#getStateHandler = handler;
  }

  static registerSubscribeHandler(handler: OnSubscribeHandler | null): void {
    SyncedStateServer.#subscribeHandler = handler;
  }

  static registerUnsubscribeHandler(
    handler: OnUnsubscribeHandler | null,
  ): void {
    SyncedStateServer.#unsubscribeHandler = handler;
  }

  static getSubscribeHandler(): OnSubscribeHandler | null {
    return SyncedStateServer.#subscribeHandler;
  }

  static getUnsubscribeHandler(): OnUnsubscribeHandler | null {
    return SyncedStateServer.#unsubscribeHandler;
  }

  #stateStore = new Map<string, SyncedStateValue>();
  #subscriptions = new Map<
    string,
    Set<RpcStub<(value: SyncedStateValue) => void>>
  >();
  #subscriptionRefs = new Map<
    string,
    Map<
      RpcStub<(value: SyncedStateValue) => void>,
      RpcStub<(value: SyncedStateValue) => void>
    >
  >();

  #getStubForHandlers(): DurableObjectStub<SyncedStateServer> | null {
    // If we have a stub already, use it
    if (this.#stub) {
      return this.#stub;
    }
    // Otherwise, try to get a stub from the registered namespace
    const namespace = SyncedStateServer.#namespace;
    if (namespace) {
      const id = namespace.idFromName(SyncedStateServer.#durableObjectName);
      return namespace.get(id);
    }
    return null;
  }

  getState(key: string): SyncedStateValue {
    const value = this.#stateStore.get(key);
    if (SyncedStateServer.#getStateHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        SyncedStateServer.#getStateHandler(key, value, stub);
      }
    }
    return value;
  }

  setState(value: SyncedStateValue, key: string): void {
    this.#stateStore.set(key, value);
    if (SyncedStateServer.#setStateHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        SyncedStateServer.#setStateHandler(key, value, stub);
      }
    }
    const subscribers = this.#subscriptions.get(key);
    if (!subscribers) {
      return;
    }
    for (const subscriber of subscribers) {
      subscriber(value).catch(() => {
        subscribers.delete(subscriber);
        const refs = this.#subscriptionRefs.get(key);
        if (refs) {
          for (const [original, duplicate] of refs) {
            if (duplicate === subscriber) {
              refs.delete(original);
              break;
            }
          }
          if (refs.size === 0) {
            this.#subscriptionRefs.delete(key);
          }
        }
      });
    }
    if (subscribers.size === 0) {
      this.#subscriptions.delete(key);
    }
  }

  subscribe(
    key: string,
    client: RpcStub<(value: SyncedStateValue) => void>,
  ): void {
    if (!this.#subscriptions.has(key)) {
      this.#subscriptions.set(key, new Set());
    }
    if (!this.#subscriptionRefs.has(key)) {
      this.#subscriptionRefs.set(key, new Map());
    }
    const duplicate =
      typeof (client as any).dup === "function"
        ? (client as any).dup()
        : client;
    this.#subscriptions.get(key)!.add(duplicate);
    this.#subscriptionRefs.get(key)!.set(client, duplicate);
  }

  unsubscribe(
    key: string,
    client: RpcStub<(value: SyncedStateValue) => void>,
  ): void {
    const duplicates = this.#subscriptionRefs.get(key);
    const duplicate = duplicates?.get(client);
    const subscribers = this.#subscriptions.get(key);
    if (duplicate && subscribers) {
      subscribers.delete(duplicate);
      duplicates!.delete(client);
      if (subscribers.size === 0) {
        this.#subscriptions.delete(key);
      }
      if (duplicates!.size === 0) {
        this.#subscriptionRefs.delete(key);
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    // Create a placeholder stub - it will be set by the worker via _setStub
    const api = new CoordinatorApi(this, this.#stub || ({} as DurableObjectStub<SyncedStateServer>));
    return newWorkersRpcResponse(request, api);
  }
}

class CoordinatorApi extends RpcTarget {
  #coordinator: SyncedStateServer;
  #stub: DurableObjectStub<SyncedStateServer>;

  constructor(coordinator: SyncedStateServer, stub: DurableObjectStub<SyncedStateServer>) {
    super();
    this.#coordinator = coordinator;
    this.#stub = stub;
    coordinator.setStub(stub);
  }

  // Internal method to set the stub - called from worker
  _setStub(stub: DurableObjectStub<SyncedStateServer>): void {
    this.#stub = stub;
    this.#coordinator.setStub(stub);
  }

  getState(key: string): SyncedStateValue {
    return this.#coordinator.getState(key);
  }

  setState(value: SyncedStateValue, key: string): void {
    this.#coordinator.setState(value, key);
  }

  subscribe(
    key: string,
    client: RpcStub<(value: SyncedStateValue) => void>,
  ): void {
    this.#coordinator.subscribe(key, client);
  }

  unsubscribe(
    key: string,
    client: RpcStub<(value: SyncedStateValue) => void>,
  ): void {
    this.#coordinator.unsubscribe(key, client);
  }
}
