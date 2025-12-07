import { RpcStub, RpcTarget, newWorkersRpcResponse } from "capnweb";
import { DurableObject } from "cloudflare:workers";

export type SyncedStateValue = unknown;

type OnSetHandler = (key: string, value: SyncedStateValue) => void;
type OnGetHandler = (key: string, value: SyncedStateValue | undefined) => void;

/**
 * Durable Object that keeps shared state for multiple clients and notifies subscribers.
 */
export class SyncedStateServer extends DurableObject {
  static #keyHandler: ((key: string) => Promise<string>) | null = null;
  static #setStateHandler: OnSetHandler | null = null;
  static #getStateHandler: OnGetHandler | null = null;

  static registerKeyHandler(handler: (key: string) => Promise<string>): void {
    SyncedStateServer.#keyHandler = handler;
  }

  static getKeyHandler(): ((key: string) => Promise<string>) | null {
    return SyncedStateServer.#keyHandler;
  }

  static registerSetStateHandler(handler: OnSetHandler | null): void {
    SyncedStateServer.#setStateHandler = handler;
  }

  static registerGetStateHandler(handler: OnGetHandler | null): void {
    SyncedStateServer.#getStateHandler = handler;
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

  getState(key: string): SyncedStateValue {
    const value = this.#stateStore.get(key);
    if (SyncedStateServer.#getStateHandler) {
      SyncedStateServer.#getStateHandler(key, value);
    }
    return value;
  }

  setState(value: SyncedStateValue, key: string): void {
    this.#stateStore.set(key, value);
    if (SyncedStateServer.#setStateHandler) {
      SyncedStateServer.#setStateHandler(key, value);
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
    const api = new CoordinatorApi(this);
    return newWorkersRpcResponse(request, api);
  }
}

class CoordinatorApi extends RpcTarget {
  #coordinator: SyncedStateServer;

  constructor(coordinator: SyncedStateServer) {
    super();
    this.#coordinator = coordinator;
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
