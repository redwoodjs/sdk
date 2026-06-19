import { DurableObject } from "cloudflare:workers";
import type { RequestInfo } from "../runtime/requestInfo/types";
import {
  type ClientMessage,
  type ServerMessage,
  type SyncedStateValue,
  unpackClientMessage,
  packMessage,
} from "./protocol-hibernation.mjs";

export type SyncedStateServerHibernationAttachment = {
  clientId: string;
  subscriptions: Array<{ userKey: string; storageKey: string }>;
};

type OnSetHandler = (
  key: string,
  value: SyncedStateValue,
  stub: DurableObjectStub<SyncedStateServerHibernation>,
) => void;
type OnGetHandler = (
  key: string,
  value: SyncedStateValue | undefined,
  stub: DurableObjectStub<SyncedStateServerHibernation>,
) => void;
type OnKeyHandler = (
  key: string,
  stub: DurableObjectStub<SyncedStateServerHibernation>,
) => Promise<string>;
type OnRoomHandler = (
  roomId: string | undefined,
  requestInfo: RequestInfo | null,
) => Promise<string>;
type OnSubscribeHandler = (
  key: string,
  stub: DurableObjectStub<SyncedStateServerHibernation>,
) => void;
type OnUnsubscribeHandler = (
  key: string,
  stub: DurableObjectStub<SyncedStateServerHibernation>,
) => void;

/**
 * Durable Object that keeps shared state for multiple clients and notifies
 * subscribers, using the Cloudflare Hibernation WebSocket API so idle
 * connections do not keep the object active.
 *
 * The implementation copies the hibernation lifecycle pattern from the older
 * RealtimeDurableObject but replaces its RSC/action protocol with a small
 * JSON state-sync protocol.
 *
 * Keys are expected to arrive already transformed by the worker proxy (via
 * registerKeyHandler). The DO stores and broadcasts using the `storageKey`
 * provided in each message, but sends user-facing `key` values back to the
 * client.
 */
export class SyncedStateServerHibernation extends DurableObject {
  static #keyHandler: OnKeyHandler | null = null;
  static #roomHandler: OnRoomHandler | null = null;
  static #setStateHandler: OnSetHandler | null = null;
  static #getStateHandler: OnGetHandler | null = null;
  static #subscribeHandler: OnSubscribeHandler | null = null;
  static #unsubscribeHandler: OnUnsubscribeHandler | null = null;
  static #namespace: DurableObjectNamespace<SyncedStateServerHibernation> | null = null;
  static #durableObjectName: string = "syncedStateHibernation";

  static registerKeyHandler(handler: OnKeyHandler | null): void {
    SyncedStateServerHibernation.#keyHandler = handler;
  }

  static getKeyHandler(): OnKeyHandler | null {
    return SyncedStateServerHibernation.#keyHandler;
  }

  static registerRoomHandler(handler: OnRoomHandler | null): void {
    SyncedStateServerHibernation.#roomHandler = handler;
  }

  static getRoomHandler(): OnRoomHandler | null {
    return SyncedStateServerHibernation.#roomHandler;
  }

  static registerNamespace(
    namespace: DurableObjectNamespace<SyncedStateServerHibernation>,
    durableObjectName?: string,
  ): void {
    SyncedStateServerHibernation.#namespace = namespace;
    if (durableObjectName) {
      SyncedStateServerHibernation.#durableObjectName = durableObjectName;
    }
  }

  static getNamespace(): DurableObjectNamespace<SyncedStateServerHibernation> | null {
    return SyncedStateServerHibernation.#namespace;
  }

  static getDurableObjectName(): string {
    return SyncedStateServerHibernation.#durableObjectName;
  }

  static registerSetStateHandler(handler: OnSetHandler | null): void {
    SyncedStateServerHibernation.#setStateHandler = handler;
  }

  static registerGetStateHandler(handler: OnGetHandler | null): void {
    SyncedStateServerHibernation.#getStateHandler = handler;
  }

  static registerSubscribeHandler(handler: OnSubscribeHandler | null): void {
    SyncedStateServerHibernation.#subscribeHandler = handler;
  }

  static registerUnsubscribeHandler(handler: OnUnsubscribeHandler | null): void {
    SyncedStateServerHibernation.#unsubscribeHandler = handler;
  }

  static getSubscribeHandler(): OnSubscribeHandler | null {
    return SyncedStateServerHibernation.#subscribeHandler;
  }

  static getUnsubscribeHandler(): OnUnsubscribeHandler | null {
    return SyncedStateServerHibernation.#unsubscribeHandler;
  }

  state: DurableObjectState;
  env: Env;
  storage: DurableObjectStorage;
  #stub: DurableObjectStub<SyncedStateServerHibernation> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  setStub(stub: DurableObjectStub<SyncedStateServerHibernation>): void {
    this.#stub = stub;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") ?? crypto.randomUUID();

    const { 0: client, 1: server } = new WebSocketPair();

    const attachment: SyncedStateServerHibernationAttachment = {
      clientId,
      subscriptions: [],
    };
    server.serializeAttachment(attachment);
    this.state.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: string | ArrayBuffer) {
    if (typeof data !== "string") {
      this.#sendError(ws, "Expected text WebSocket message");
      return;
    }

    let message: ClientMessage;
    try {
      message = unpackClientMessage(data);
    } catch (error) {
      this.#sendError(
        ws,
        error instanceof Error ? error.message : "Invalid protocol message",
      );
      return;
    }

    const storageKey = message.storageKey ?? message.key;

    // After hibernation the in-memory subscription map is empty. Rehydrate it
    // from the socket attachment before handling any message that depends on
    // knowing this socket's subscriptions (especially broadcasts on setState).
    this.#ensureSubscriptionsLoaded(ws);

    switch (message.kind) {
      case "getState": {
        const value = await this.#getState(storageKey);
        this.#send(ws, {
          kind: "getState",
          key: message.key,
          value,
          id: message.id,
        });
        break;
      }
      case "setState": {
        await this.#setState(storageKey, message.value);
        this.#send(ws, {
          kind: "setState",
          key: message.key,
          id: message.id,
        });
        break;
      }
      case "subscribe": {
        this.#subscribe(ws, storageKey, message.key);
        this.#send(ws, {
          kind: "subscribe",
          key: message.key,
          id: message.id,
        });
        break;
      }
      case "unsubscribe": {
        this.#unsubscribe(ws, storageKey, message.key);
        this.#send(ws, {
          kind: "unsubscribe",
          key: message.key,
          id: message.id,
        });
        break;
      }
      default: {
        this.#sendError(ws, "Unknown message kind", (message as any).id);
      }
    }
  }

  async webSocketClose(ws: WebSocket) {
    // context(justinvdm, 18 Jun 2026): Remove this socket from all in-memory
    // subscription sets. The attachment is dropped by the runtime, so no
    // persistent cleanup is required.
    for (const subscribers of this.#subscriptions.values()) {
      for (const entry of subscribers) {
        if (entry.ws === ws) {
          subscribers.delete(entry);
          break;
        }
      }
    }
    for (const [key, subscribers] of this.#subscriptions) {
      if (subscribers.size === 0) {
        this.#subscriptions.delete(key);
      }
    }
  }

  // Public RPC surface exposed to handler callbacks and other Workers RPC callers.
  async getState(key: string): Promise<SyncedStateValue | undefined> {
    return this.#getState(key);
  }

  async setState(value: SyncedStateValue, key: string): Promise<void> {
    await this.#setState(key, value);
  }

  // ---------------------------------------------------------------------------
  // State storage
  // ---------------------------------------------------------------------------

  // In-memory cache backed by Durable Object storage. Hibernation can evict
  // the DO, so every write is persisted and the cache is warmed on first read.
  #stateStore = new Map<string, SyncedStateValue>();
  #stateStoreLoaded = false;

  async #loadStateStore(): Promise<void> {
    if (this.#stateStoreLoaded) {
      return;
    }

    const entries = await this.storage.list<SyncedStateValue>({
      prefix: "state:",
    });

    for (const [storageKey, value] of entries) {
      const key = storageKey.slice("state:".length);
      this.#stateStore.set(key, value);
    }

    this.#stateStoreLoaded = true;
  }

  #stateStorageKey(key: string): string {
    return `state:${key}`;
  }

  async #getState(key: string): Promise<SyncedStateValue | undefined> {
    await this.#loadStateStore();

    const value = this.#stateStore.get(key);
    if (SyncedStateServerHibernation.#getStateHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        SyncedStateServerHibernation.#getStateHandler(key, value, stub);
      }
    }
    return value;
  }

  async #setState(key: string, value: SyncedStateValue): Promise<void> {
    await this.#loadStateStore();

    this.#stateStore.set(key, value);
    await this.storage.put(this.#stateStorageKey(key), value);

    if (SyncedStateServerHibernation.#setStateHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        SyncedStateServerHibernation.#setStateHandler(key, value, stub);
      }
    }
    this.#broadcastUpdate(key, value);
  }

  // ---------------------------------------------------------------------------
  // Subscriptions
  // ---------------------------------------------------------------------------

  // Map from storage key to the subscribers for that key. We store the
  // user-facing key per subscriber so broadcasts can send each socket the key
  // it originally subscribed to.
  #subscriptions = new Map<string, Set<{ ws: WebSocket; userKey: string }>>();

  #subscribe(ws: WebSocket, storageKey: string, userKey: string): void {
    if (!this.#subscriptions.has(storageKey)) {
      this.#subscriptions.set(storageKey, new Set());
    }
    const subscribers = this.#subscriptions.get(storageKey)!;

    // Defensive deduplication: a stateful client may send subscribe more than
    // once for the same key (e.g. across reconnects), and hibernation can
    // rehydrate the same subscription from the attachment. Keep only one entry
    // per (socket, userKey) pair.
    for (const entry of subscribers) {
      if (entry.ws === ws && entry.userKey === userKey) {
        return;
      }
    }
    subscribers.add({ ws, userKey });

    const subscribeHandler = SyncedStateServerHibernation.#subscribeHandler;
    if (subscribeHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        subscribeHandler(storageKey, stub);
      }
    }

    // Persist the subscription in the socket attachment so it survives
    // hibernation.
    const subs = this.#getSubscriptionsFromAttachment(ws);
    if (!subs.some((s) => s.userKey === userKey && s.storageKey === storageKey)) {
      subs.push({ userKey, storageKey });
      this.#setSubscriptionsInAttachment(ws, subs);
    }
  }

  #unsubscribe(ws: WebSocket, storageKey: string, userKey: string): void {
    const subscribers = this.#subscriptions.get(storageKey);
    if (subscribers) {
      for (const entry of subscribers) {
        if (entry.ws === ws && entry.userKey === userKey) {
          subscribers.delete(entry);
          break;
        }
      }
      if (subscribers.size === 0) {
        this.#subscriptions.delete(storageKey);
      }
    }

    const unsubscribeHandler = SyncedStateServerHibernation.#unsubscribeHandler;
    if (unsubscribeHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        unsubscribeHandler(storageKey, stub);
      }
    }

    const subs = this.#getSubscriptionsFromAttachment(ws).filter(
      (s) => !(s.userKey === userKey && s.storageKey === storageKey),
    );
    this.#setSubscriptionsInAttachment(ws, subs);
  }

  #broadcastUpdate(key: string, value: SyncedStateValue): void {
    const subscribers = this.#subscriptions.get(key);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    for (const { ws, userKey } of subscribers) {
      const message: ServerMessage = {
        kind: "update",
        key: userKey,
        value,
      };
      try {
        ws.send(packMessage(message));
      } catch {
        // Socket is already closed; it will be cleaned up via webSocketClose.
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Attachment helpers
  // ---------------------------------------------------------------------------

  #getAttachment(ws: WebSocket): SyncedStateServerHibernationAttachment {
    const raw = ws.deserializeAttachment();
    if (
      raw &&
      typeof raw === "object" &&
      "subscriptions" in raw &&
      Array.isArray((raw as any).subscriptions)
    ) {
      return raw as SyncedStateServerHibernationAttachment;
    }
    return { clientId: "", subscriptions: [] };
  }

  #getSubscriptionsFromAttachment(
    ws: WebSocket,
  ): Array<{ userKey: string; storageKey: string }> {
    return this.#getAttachment(ws).subscriptions;
  }

  #setSubscriptionsInAttachment(
    ws: WebSocket,
    subscriptions: Array<{ userKey: string; storageKey: string }>,
  ): void {
    const attachment = this.#getAttachment(ws);
    attachment.subscriptions = subscriptions;
    ws.serializeAttachment(attachment);
  }

  #ensureSubscriptionsLoaded(ws: WebSocket): void {
    const subs = this.#getSubscriptionsFromAttachment(ws);
    for (const { userKey, storageKey } of subs) {
      if (!this.#subscriptions.has(storageKey)) {
        this.#subscriptions.set(storageKey, new Set());
      }
      const subscribers = this.#subscriptions.get(storageKey)!;
      let exists = false;
      for (const entry of subscribers) {
        if (entry.ws === ws && entry.userKey === userKey) {
          exists = true;
          break;
        }
      }
      if (!exists) {
        subscribers.add({ ws, userKey });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  #getStubForHandlers(): DurableObjectStub<SyncedStateServerHibernation> | null {
    if (this.#stub) {
      return this.#stub;
    }
    const namespace = SyncedStateServerHibernation.#namespace;
    if (namespace) {
      return namespace.get(this.ctx.id);
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  #send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(packMessage(message));
    } catch {
      // Ignore send failures on closed sockets.
    }
  }

  #sendError(ws: WebSocket, message: string, id?: string): void {
    this.#send(ws, { kind: "error", message, id });
  }
}
