import { RpcTarget, newWorkersRpcResponse } from "capnweb";
import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import { runWithRequestInfo } from "../runtime/requestInfo/worker";
import type { RequestInfo } from "../runtime/requestInfo/types";
import {
  SyncedStateServer,
  type SyncedStateValue,
} from "./SyncedStateServer.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export { SyncedStateServer };

export type SyncedStateRouteOptions = {
  basePath?: string;
  durableObjectName?: string;
};

const DEFAULT_SYNC_STATE_NAME = "syncedState";

class SyncedStateProxy extends RpcTarget {
  #stub: any;
  #keyHandler: ((key: string) => Promise<string>) | null;
  #requestInfo: RequestInfo | null;

  constructor(
    stub: any,
    keyHandler: ((key: string) => Promise<string>) | null,
    requestInfo: RequestInfo | null,
  ) {
    super();
    this.#stub = stub;
    this.#keyHandler = keyHandler;
    this.#requestInfo = requestInfo;
    // Set stub in DO instance so handlers can access it
    if (stub && typeof (stub as any)._setStub === 'function') {
      void (stub as any)._setStub(stub);
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
    handler: (key: string) => void | ((key: string, stub: any) => void),
    key: string,
    stub?: any,
  ): void {
    if (this.#requestInfo) {
      // Preserve async context when calling handler so requestInfo.ctx is available
      runWithRequestInfo(this.#requestInfo, () => {
        if (stub !== undefined) {
          (handler as (key: string, stub: any) => void)(key, stub);
        } else {
          (handler as (key: string) => void)(key);
        }
      });
    } else {
      if (stub !== undefined) {
        (handler as (key: string, stub: any) => void)(key, stub);
      } else {
        (handler as (key: string) => void)(key);
      }
    }
  }

  async getState(key: string): Promise<SyncedStateValue> {
    const transformedKey = await this.#transformKey(key);
    return this.#stub.getState(transformedKey);
  }

  async setState(value: SyncedStateValue, key: string): Promise<void> {
    const transformedKey = await this.#transformKey(key);
    return this.#stub.setState(value, transformedKey);
  }

  async subscribe(key: string, client: any): Promise<void> {
    const transformedKey = await this.#transformKey(key);

    const subscribeHandler = SyncedStateServer.getSubscribeHandler();
    if (subscribeHandler) {
      this.#callHandler(subscribeHandler, transformedKey, this.#stub);
    }

    // dup the client if it is a function; otherwise, pass it as is;
    // this is because the client is a WebSocketRpcSession, and we need to pass a new instance of the client to the DO;
    const clientToPass =
      typeof client.dup === "function" ? client.dup() : client;
    return this.#stub.subscribe(transformedKey, clientToPass);
  }

  async unsubscribe(key: string, client: any): Promise<void> {
    const transformedKey = await this.#transformKey(key);

    // Call unsubscribe handler before unsubscribe, similar to subscribe handler
    // This ensures the handler is called even if the unsubscribe doesn't find a match
    // or if the RPC call fails
    const unsubscribeHandler = SyncedStateServer.getUnsubscribeHandler();
    if (unsubscribeHandler) {
      this.#callHandler(unsubscribeHandler, transformedKey, this.#stub);
    }

    try {
      await this.#stub.unsubscribe(transformedKey, client);
    } catch (error) {
      // Ignore errors during unsubscribe - handler has already been called
      // This prevents RPC stub disposal errors from propagating
    }
  }
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

  const forwardRequest = async (
    request: Request,
    requestInfo: RequestInfo,
  ) => {
    const namespace = getNamespace(env);
    // Register the namespace and DO name so handlers can access it
    SyncedStateServer.registerNamespace(namespace, durableObjectName);
    
    const keyHandler = SyncedStateServer.getKeyHandler();

    if (!keyHandler) {
      const id = namespace.idFromName(durableObjectName);
      return namespace.get(id).fetch(request);
    }

    const id = namespace.idFromName(durableObjectName);
    const coordinator = namespace.get(id);
    const proxy = new SyncedStateProxy(coordinator, keyHandler, requestInfo);

    return newWorkersRpcResponse(request, proxy);
  };

  return [route(basePath, (requestInfo) => forwardRequest(requestInfo.request, requestInfo))];
};
