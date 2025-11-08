import { RpcStub, RpcTarget } from "capnweb";
import { DurableObject } from "cloudflare:workers";

export type SyncStateValue = unknown;

type OnSetHandler = (key: string, value: SyncStateValue) => void;
type OnGetHandler = (key: string, value: SyncStateValue | undefined) => void;

let onSetState: OnSetHandler | null = null;
let onGetState: OnGetHandler | null = null;

export const registerSetStateCallback = (handler: OnSetHandler | null) => {
  onSetState = handler;
};

export const registerGetStateCallback = (handler: OnGetHandler | null) => {
  onGetState = handler;
};

export class SyncStateCoordinator extends DurableObject {
  #stateStore = new Map<string, SyncStateValue>();
  #subscriptions = new Map<
    string,
    Set<RpcStub<(value: SyncStateValue) => void>>
  >();
  #subscriptionRefs = new Map<
    string,
    Map<
      RpcStub<(value: SyncStateValue) => void>,
      RpcStub<(value: SyncStateValue) => void>
    >
  >();

  getState(key: string): SyncStateValue {
    const value = this.#stateStore.get(key);
    if (onGetState) {
      onGetState(key, value);
    }
    return value;
  }

  setState(value: SyncStateValue, key: string): void {
    this.#stateStore.set(key, value);
    if (onSetState) {
      onSetState(key, value);
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
    client: RpcStub<(value: SyncStateValue) => void>,
  ): void {
    if (!this.#subscriptions.has(key)) {
      this.#subscriptions.set(key, new Set());
    }
    if (!this.#subscriptionRefs.has(key)) {
      this.#subscriptionRefs.set(key, new Map());
    }
    const duplicate = client.dup();
    this.#subscriptions.get(key)!.add(duplicate);
    this.#subscriptionRefs.get(key)!.set(client, duplicate);
  }

  unsubscribe(
    key: string,
    client: RpcStub<(value: SyncStateValue) => void>,
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
}

class CoordinatorApi extends RpcTarget {
  #coordinator: SyncStateCoordinator;

  constructor(coordinator: SyncStateCoordinator) {
    super();
    this.#coordinator = coordinator;
  }

  getState(key: string): SyncStateValue {
    return this.#coordinator.getState(key);
  }

  setState(value: SyncStateValue, key: string): void {
    this.#coordinator.setState(value, key);
  }

  subscribe(
    key: string,
    client: RpcStub<(value: SyncStateValue) => void>,
  ): void {
    this.#coordinator.subscribe(key, client);
  }

  unsubscribe(
    key: string,
    client: RpcStub<(value: SyncStateValue) => void>,
  ): void {
    this.#coordinator.unsubscribe(key, client);
  }
}
