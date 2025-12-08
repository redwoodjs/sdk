import { RpcTarget, newWorkersRpcResponse } from "capnweb";
import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
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

  constructor(
    stub: any,
    keyHandler: ((key: string) => Promise<string>) | null,
  ) {
    super();
    this.#stub = stub;
    this.#keyHandler = keyHandler;
  }

  async getState(key: string): Promise<SyncedStateValue> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;
    return this.#stub.getState(transformedKey);
  }

  async setState(value: SyncedStateValue, key: string): Promise<void> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;
    return this.#stub.setState(value, transformedKey);
  }

  async subscribe(key: string, client: any): Promise<void> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;

    const subscribeHandler = SyncedStateServer.getSubscribeHandler();
    if (subscribeHandler) {
      subscribeHandler(transformedKey);
    }

    // dup the client if it is a function; otherwise, pass it as is;
    // this is because the client is a WebSocketRpcSession, and we need to pass a new instance of the client to the DO;
    const clientToPass =
      typeof client.dup === "function" ? client.dup() : client;
    return this.#stub.subscribe(transformedKey, clientToPass);
  }

  async unsubscribe(key: string, client: any): Promise<void> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;

    const unsubscribeHandler = SyncedStateServer.getUnsubscribeHandler();
    if (unsubscribeHandler) {
      unsubscribeHandler(transformedKey);
    }

    return this.#stub.unsubscribe(transformedKey, client);
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

  const forwardRequest = async (request: Request) => {
    const keyHandler = SyncedStateServer.getKeyHandler();

    if (!keyHandler) {
      const namespace = getNamespace(env);
      const id = namespace.idFromName(durableObjectName);
      return namespace.get(id).fetch(request);
    }

    const namespace = getNamespace(env);
    const id = namespace.idFromName(durableObjectName);
    const coordinator = namespace.get(id);
    const proxy = new SyncedStateProxy(coordinator, keyHandler);

    return newWorkersRpcResponse(request, proxy);
  };

  return [route(basePath, ({ request }) => forwardRequest(request))];
};
