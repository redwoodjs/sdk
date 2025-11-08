import { RpcStub, RpcTarget } from "capnweb";
import { DurableObject } from "cloudflare:workers";

export type SyncedStateValue = unknown;

export class SyncedStateCoordinator extends DurableObject {
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
    return this.#stateStore.get(key);
  }

  setState(value: SyncedStateValue, key: string): void {
    this.#stateStore.set(key, value);
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
    const duplicate = client.dup();
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
}

class CoordinatorApi extends RpcTarget {
  #coordinator: SyncedStateCoordinator;

  constructor(coordinator: SyncedStateCoordinator) {
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
