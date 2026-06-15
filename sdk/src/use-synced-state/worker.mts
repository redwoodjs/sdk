import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import {
  StaleClientError,
  type StalePolicy,
} from "../runtime/lib/stale.js";
import type { RequestInfo } from "../runtime/requestInfo/types";
import { runWithRequestInfo } from "../runtime/requestInfo/worker";
import { loadCapnweb } from "./capnweb-loader.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";
import {
  SyncedStateServer,
  type SyncedStateValue,
} from "./SyncedStateServer.mjs";

export { SyncedStateServer };

export type SyncedStateRouteOptions = {
  basePath?: string;
  durableObjectName?: string;
  // When stale handling is configured (e.g. { onStale: "reload" }), route
  // through SyncedStateProxy so data-level stale-client detection runs even
  // without a custom keyHandler. Apps not opting into stale handling keep the
  // original direct-DO behavior for maximum compatibility.
  stale?: {
    onStale?: StalePolicy;
  };
};

const DEFAULT_SYNC_STATE_NAME = "syncedState";

type KeyHandler = (
  key: string,
  stub: DurableObjectStub<SyncedStateServer>,
) => Promise<string>;

type SyncedStateProxyCtor = new (
  stub: DurableObjectStub<SyncedStateServer>,
  keyHandler: KeyHandler | null,
  requestInfo: RequestInfo | null,
) => unknown;

let SyncedStateProxyClass: SyncedStateProxyCtor | null = null;

async function getSyncedStateProxy(): Promise<{
  SyncedStateProxy: SyncedStateProxyCtor;
  newWorkersRpcResponse: typeof import("capnweb").newWorkersRpcResponse;
}> {
  const { RpcTarget, newWorkersRpcResponse } = await loadCapnweb();
  if (!SyncedStateProxyClass) {
    SyncedStateProxyClass = class SyncedStateProxy extends RpcTarget {
      #stub: DurableObjectStub<SyncedStateServer>;
      #keyHandler: KeyHandler | null;
      #requestInfo: RequestInfo | null;
      // The client build ID sent via the setClientVersion RPC. Compared
      // against the worker's current build ID on every RPC message so
      // established connections that outlive a deployment are rejected.
      // Staleness for use-synced-state is handled entirely data-level over
      // the RPC channel; no query parameter or WebSocket-handshake check is
      // used.
      #clientVersion: string | undefined;
      // Map original RPC callbacks to the duplicated callbacks sent to the DO
      // so unsubscribe uses the same identity that subscribe registered.
      #subscriptionClients = new Map<string, Map<unknown, unknown>>();

      constructor(
        stub: DurableObjectStub<SyncedStateServer>,
        keyHandler: KeyHandler | null,
        requestInfo: RequestInfo | null,
      ) {
        super();
        this.#stub = stub;
        this.#keyHandler = keyHandler;
        this.#requestInfo = requestInfo;
        // Set stub in DO instance so handlers can access it
        if (stub && typeof (stub as any)._setStub === "function") {
          void (stub as any)._setStub(stub);
        }
      }

      /**
       * Stores the client's build version. This is the only way stale-client
       * detection receives the client's version for use-synced-state. The
       * WebSocket handshake carries no version metadata.
       */
      setClientVersion(version: string): void {
        this.#clientVersion = version;
      }

      /**
       * Throws if the client's build version is older than the worker's current
       * build. Checked on every RPC message so already-established WebSocket
       * sessions are rejected after a deployment.
       */
      #assertClientVersionCurrent(): void {
        const currentVersion =
          (globalThis as any).__rwsdk_stale_build_id_override ??
          import.meta.env.VITE_RWSDK_BUILD_ID;
        if (!currentVersion || !this.#clientVersion) {
          return;
        }
        if (this.#clientVersion !== currentVersion) {
          throw new StaleClientError();
        }
      }

      /**
       * Transforms a key using the keyHandler, preserving async context so requestInfo.ctx is available.
       */
      async #transformKey(key: string): Promise<string> {
        if (!this.#keyHandler) {
          return key;
        }
        if (this.#requestInfo) {
          // Preserve async context when calling keyHandler so requestInfo.ctx is available
          return await runWithRequestInfo(
            this.#requestInfo,
            async () => await this.#keyHandler!(key, this.#stub),
          );
        }
        return await this.#keyHandler(key, this.#stub);
      }

      /**
       * Calls a handler function, preserving async context so requestInfo.ctx is available.
       */
      #callHandler(
        handler: (
          key: string,
          stub: DurableObjectStub<SyncedStateServer>,
        ) => void,
        key: string,
        stub: DurableObjectStub<SyncedStateServer>,
      ): void {
        if (this.#requestInfo) {
          // Preserve async context when calling handler so requestInfo.ctx is available
          runWithRequestInfo(this.#requestInfo, () => {
            handler(key, stub);
          });
        } else {
          handler(key, stub);
        }
      }

      async getState(key: string): Promise<SyncedStateValue> {
        this.#assertClientVersionCurrent();
        const transformedKey = await this.#transformKey(key);
        return this.#stub.getState(transformedKey);
      }

      async setState(value: SyncedStateValue, key: string): Promise<void> {
        this.#assertClientVersionCurrent();
        const transformedKey = await this.#transformKey(key);
        return this.#stub.setState(value, transformedKey);
      }

      async subscribe(key: string, client: any): Promise<void> {
        this.#assertClientVersionCurrent();
        const transformedKey = await this.#transformKey(key);

        const subscribeHandler = SyncedStateServer.getSubscribeHandler();
        if (subscribeHandler) {
          this.#callHandler(subscribeHandler, transformedKey, this.#stub);
        }

        // dup the client if it is a function; otherwise, pass it as is;
        // this is because the client is a WebSocketRpcSession, and we need to pass a new instance of the client to the DO;
        const clientToPass =
          typeof client.dup === "function" ? client.dup() : client;
        let clientsForKey = this.#subscriptionClients.get(transformedKey);
        if (!clientsForKey) {
          clientsForKey = new Map();
          this.#subscriptionClients.set(transformedKey, clientsForKey);
        }
        clientsForKey.set(client, clientToPass);
        try {
          return await this.#stub.subscribe(transformedKey, clientToPass);
        } catch (error) {
          if (clientsForKey.get(client) === clientToPass) {
            clientsForKey.delete(client);
            if (clientsForKey.size === 0) {
              this.#subscriptionClients.delete(transformedKey);
            }
          }
          throw error;
        }
      }

      async unsubscribe(key: string, client: any): Promise<void> {
        this.#assertClientVersionCurrent();
        const transformedKey = await this.#transformKey(key);

        // Call unsubscribe handler before unsubscribe, similar to subscribe handler
        // This ensures the handler is called even if the unsubscribe doesn't find a match
        // or if the RPC call fails
        const unsubscribeHandler = SyncedStateServer.getUnsubscribeHandler();
        if (unsubscribeHandler) {
          this.#callHandler(unsubscribeHandler, transformedKey, this.#stub);
        }

        const clientsForKey = this.#subscriptionClients.get(transformedKey);
        const clientToPass = clientsForKey?.get(client) ?? client;

        try {
          await this.#stub.unsubscribe(transformedKey, clientToPass);
        } catch (error) {
          // Ignore errors during unsubscribe - handler has already been called
          // This prevents RPC stub disposal errors from propagating
        } finally {
          if (clientsForKey && clientsForKey.get(client) === clientToPass) {
            clientsForKey.delete(client);
            if (clientsForKey.size === 0) {
              this.#subscriptionClients.delete(transformedKey);
            }
          }
        }
      }
    } as unknown as SyncedStateProxyCtor;
  }
  return {
    SyncedStateProxy: SyncedStateProxyClass,
    newWorkersRpcResponse,
  };
}

/**
 * Registers routes that forward sync state requests to the configured Durable Object namespace.
 * @param getNamespace Function that returns the Durable Object namespace from the Worker env.
 * @param options Optional overrides for base path and object name.
 * @returns Router entries for the sync state API.
 */
export const syncedStateRoutes = (
  getNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<SyncedStateServer>,
  options: SyncedStateRouteOptions = {},
) => {
  const basePath = options.basePath ?? DEFAULT_SYNCED_STATE_PATH;
  const durableObjectName =
    options.durableObjectName ?? DEFAULT_SYNC_STATE_NAME;

  const forwardRequest = async (request: Request, requestInfo: RequestInfo) => {
    const namespace = getNamespace(env);
    // Register the namespace and DO name so handlers can access it
    SyncedStateServer.registerNamespace(namespace, durableObjectName);

    const keyHandler = SyncedStateServer.getKeyHandler();
    const roomHandler = SyncedStateServer.getRoomHandler();

    // Get the room ID from the URL parameter, or undefined if not present
    const idParam = requestInfo.params?.id;

    // Resolve the room name using the roomHandler if present, otherwise use the param or default
    let resolvedRoomName: string;
    if (roomHandler) {
      resolvedRoomName = await runWithRequestInfo(
        requestInfo,
        async () => await roomHandler(idParam, requestInfo),
      );
    } else {
      resolvedRoomName = idParam ?? durableObjectName;
    }

    // Preserve the original direct-DO behavior for apps that do not opt into
    // stale handling. As soon as a keyHandler is registered or stale handling
    // is configured we go through SyncedStateProxy: the proxy is where the
    // data-level stale-client checks live, and it defaults to an identity key
    // handler so apps like PRZM (room handler only) still get those checks.
    const staleEnabled = options.stale?.onStale != null;
    if (!keyHandler && !staleEnabled) {
      const id = namespace.idFromName(resolvedRoomName);
      return namespace.get(id).fetch(request);
    }

    const effectiveKeyHandler = keyHandler ?? (async (key: string) => key);

    const id = namespace.idFromName(resolvedRoomName);
    const coordinator = namespace.get(id);
    const { SyncedStateProxy, newWorkersRpcResponse } =
      await getSyncedStateProxy();
    const proxy = new SyncedStateProxy(
      coordinator,
      effectiveKeyHandler,
      requestInfo,
    );

    return newWorkersRpcResponse(request, proxy);
  };

  return [
    route(basePath, (requestInfo) =>
      forwardRequest(requestInfo.request, requestInfo),
    ),
    route(basePath + "/:id", (requestInfo) =>
      forwardRequest(requestInfo.request, requestInfo),
    ),
  ];
};
