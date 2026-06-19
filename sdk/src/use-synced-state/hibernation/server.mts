import { DurableObject } from "cloudflare:workers";
import type { RequestInfo } from "../../runtime/requestInfo/types";
import {
  type SyncedStateIdentity,
  getIdentityFromUrl,
} from "./identity.mjs";
import {
  type ClientMessage,
  type ServerMessage,
  type SyncedStateValue,
  unpackClientMessage,
  packMessage,
} from "./protocol.mjs";

export type SyncedStateServerAttachment = {
  clientId: string;
  identity: SyncedStateIdentity;
  subscriptions: Array<{ userKey: string; storageKey: string }>;
};

type OnSetHandler = (
  key: string,
  value: SyncedStateValue,
  identity: SyncedStateIdentity,
  stub: DurableObjectStub<SyncedStateServer>,
) => void;
type OnGetHandler = (
  key: string,
  value: SyncedStateValue | undefined,
  identity: SyncedStateIdentity,
  stub: DurableObjectStub<SyncedStateServer>,
) => void;
type OnKeyHandler = (
  key: string,
  identity: SyncedStateIdentity,
  stub: DurableObjectStub<SyncedStateServer>,
) => Promise<string>;
type OnRoomHandler = (
  roomId: string | undefined,
  requestInfo: RequestInfo | null,
) => Promise<string>;
type OnSubscribeHandler = (
  key: string,
  identity: SyncedStateIdentity,
  stub: DurableObjectStub<SyncedStateServer>,
) => void;
type OnUnsubscribeHandler = (
  key: string,
  identity: SyncedStateIdentity,
  stub: DurableObjectStub<SyncedStateServer>,
) => void;
type IdentityExtractor = (
  requestInfo: RequestInfo,
) => SyncedStateIdentity | Promise<SyncedStateIdentity>;

/**
 * Durable Object that keeps shared state for multiple clients and notifies
 * subscribers, using the Cloudflare Hibernation WebSocket API so idle
 * connections do not keep the object active.
 *
 * The implementation copies the lifecycle pattern from the older
 * RealtimeDurableObject but replaces its RSC/action protocol with a small
 * JSON state-sync protocol.
 *
 * Keys arrive as user-facing values. When a key handler is registered, the DO
 * transforms them internally using the identity captured at upgrade time by
 * the worker. This lets the worker hand off the WebSocket and exit instead of
 * staying alive as a proxy.
 */
export class SyncedStateServer extends DurableObject {
  static #keyHandler: OnKeyHandler | null = null;
  static #roomHandler: OnRoomHandler | null = null;
  static #setStateHandler: OnSetHandler | null = null;
  static #getStateHandler: OnGetHandler | null = null;
  static #subscribeHandler: OnSubscribeHandler | null = null;
  static #unsubscribeHandler: OnUnsubscribeHandler | null = null;
  static #identityExtractor: IdentityExtractor | null = null;
  static #namespace: DurableObjectNamespace<SyncedStateServer> | null = null;
  static #durableObjectName: string = "syncedStateHibernation";

  static registerKeyHandler(handler: OnKeyHandler | null): void {
    SyncedStateServer.#keyHandler = handler;
  }

  static getKeyHandler(): OnKeyHandler | null {
    return SyncedStateServer.#keyHandler;
  }

  static registerRoomHandler(handler: OnRoomHandler | null): void {
    SyncedStateServer.#roomHandler = handler;
  }

  static getRoomHandler(): OnRoomHandler | null {
    return SyncedStateServer.#roomHandler;
  }

  static registerIdentityExtractor(
    extractor: IdentityExtractor | null,
  ): void {
    SyncedStateServer.#identityExtractor = extractor;
  }

  static getIdentityExtractor(): IdentityExtractor | null {
    return SyncedStateServer.#identityExtractor;
  }

  static registerNamespace(
    namespace: DurableObjectNamespace<SyncedStateServer>,
    durableObjectName?: string,
  ): void {
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

  static registerSetStateHandler(handler: OnSetHandler | null): void {
    SyncedStateServer.#setStateHandler = handler;
  }

  static registerGetStateHandler(handler: OnGetHandler | null): void {
    SyncedStateServer.#getStateHandler = handler;
  }

  static registerSubscribeHandler(handler: OnSubscribeHandler | null): void {
    SyncedStateServer.#subscribeHandler = handler;
  }

  static registerUnsubscribeHandler(handler: OnUnsubscribeHandler | null): void {
    SyncedStateServer.#unsubscribeHandler = handler;
  }

  static getSubscribeHandler(): OnSubscribeHandler | null {
    return SyncedStateServer.#subscribeHandler;
  }

  static getUnsubscribeHandler(): OnUnsubscribeHandler | null {
    return SyncedStateServer.#unsubscribeHandler;
  }

  state: DurableObjectState;
  env: Env;
  storage: DurableObjectStorage;
  #stub: DurableObjectStub<SyncedStateServer> | null = null;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.storage = state.storage;
  }

  setStub(stub: DurableObjectStub<SyncedStateServer>): void {
    this.#stub = stub;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") ?? crypto.randomUUID();
    const identity = getIdentityFromUrl(url);

    const { 0: client, 1: server } = new WebSocketPair();

    const attachment: SyncedStateServerAttachment = {
      clientId,
      identity,
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

    // After DO eviction the in-memory subscription map is empty. Rehydrate it
    // from the socket attachment before handling any message that depends on
    // knowing this socket's subscriptions (especially broadcasts on setState).
    this.#ensureSubscriptionsLoaded(ws);

    const identity = this.#getIdentity(ws);
    const storageKey = await this.#resolveStorageKey(message.key, identity);

    switch (message.kind) {
      case "getState": {
        const value = await this.#getState(storageKey, identity);
        this.#send(ws, {
          kind: "getState",
          key: message.key,
          value,
          id: message.id,
        });
        break;
      }
      case "setState": {
        await this.#setState(storageKey, message.value, identity);
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
    return this.#getState(key, undefined);
  }

  async setState(value: SyncedStateValue, key: string): Promise<void> {
    await this.#setState(key, value, undefined);
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

  async #getState(
    key: string,
    identity: SyncedStateIdentity,
  ): Promise<SyncedStateValue | undefined> {
    await this.#loadStateStore();

    const value = this.#stateStore.get(key);
    if (SyncedStateServer.#getStateHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        SyncedStateServer.#getStateHandler(key, value, identity, stub);
      }
    }
    return value;
  }

  async #setState(
    key: string,
    value: SyncedStateValue,
    identity: SyncedStateIdentity,
  ): Promise<void> {
    await this.#loadStateStore();

    this.#stateStore.set(key, value);
    await this.storage.put(this.#stateStorageKey(key), value);

    if (SyncedStateServer.#setStateHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        SyncedStateServer.#setStateHandler(key, value, identity, stub);
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
    // once for the same key (e.g. across reconnects), and DO eviction can
    // rehydrate the same subscription from the attachment. Keep only one entry
    // per (socket, userKey) pair.
    for (const entry of subscribers) {
      if (entry.ws === ws && entry.userKey === userKey) {
        return;
      }
    }
    subscribers.add({ ws, userKey });

    const identity = this.#getIdentity(ws);
    const subscribeHandler = SyncedStateServer.#subscribeHandler;
    if (subscribeHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        subscribeHandler(storageKey, identity, stub);
      }
    }

    // Persist the subscription in the socket attachment so it survives
    // DO eviction.
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

    const identity = this.#getIdentity(ws);
    const unsubscribeHandler = SyncedStateServer.#unsubscribeHandler;
    if (unsubscribeHandler) {
      const stub = this.#getStubForHandlers();
      if (stub) {
        unsubscribeHandler(storageKey, identity, stub);
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

  #getAttachment(ws: WebSocket): SyncedStateServerAttachment {
    const raw = ws.deserializeAttachment();
    if (
      raw &&
      typeof raw === "object" &&
      "subscriptions" in raw &&
      Array.isArray((raw as any).subscriptions)
    ) {
      return raw as SyncedStateServerAttachment;
    }
    return { clientId: "", identity: undefined, subscriptions: [] };
  }

  #getIdentity(ws: WebSocket): SyncedStateIdentity {
    return this.#getAttachment(ws).identity;
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

  async #resolveStorageKey(
    key: string,
    identity: SyncedStateIdentity,
  ): Promise<string> {
    const keyHandler = SyncedStateServer.#keyHandler;
    if (keyHandler) {
      const stub = this.#getStubForHandlers();
      return await keyHandler(key, identity, stub ?? ({} as any));
    }
    return key;
  }

  #getStubForHandlers(): DurableObjectStub<SyncedStateServer> | null {
    if (this.#stub) {
      return this.#stub;
    }
    const namespace = SyncedStateServer.#namespace;
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
