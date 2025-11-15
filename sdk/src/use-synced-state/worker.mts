import { RpcTarget, newWorkersRpcResponse } from "capnweb";
import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import { SyncStateServer, type SyncStateValue } from "./SyncStateServer.mjs";
import { DEFAULT_SYNC_STATE_PATH } from "./constants.mjs";

export { SyncStateServer } from "./SyncStateServer.mjs";

export type SyncStateRouteOptions = {
  basePath?: string;
  resetPath?: string;
  durableObjectName?: string;
};

const DEFAULT_SYNC_STATE_NAME = "syncedState";

class SyncStateProxy extends RpcTarget {
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

  async getState(key: string): Promise<SyncStateValue> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;
    return this.#stub.getState(transformedKey);
  }

  async setState(value: SyncStateValue, key: string): Promise<void> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;
    return this.#stub.setState(value, transformedKey);
  }

  async subscribe(key: string, client: any): Promise<void> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;
    return this.#stub.subscribe(transformedKey, client);
  }

  async unsubscribe(key: string, client: any): Promise<void> {
    const transformedKey = this.#keyHandler ? await this.#keyHandler(key) : key;
    return this.#stub.unsubscribe(transformedKey, client);
  }
}

/**
 * Registers routes that forward sync state requests to the configured Durable Object namespace.
 * @param getNamespace Function that returns the Durable Object namespace from the Worker env.
 * @param options Optional overrides for base path, reset path, and object name.
 * @returns Router entries for the sync state API and reset endpoint.
 */
export const syncStateRoutes = (
  getNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<SyncStateServer>,
  options: SyncStateRouteOptions = {},
) => {
  const basePath = options.basePath ?? DEFAULT_SYNC_STATE_PATH;
  const resetPath = options.resetPath ?? `${basePath}/reset`;
  const durableObjectName =
    options.durableObjectName ?? DEFAULT_SYNC_STATE_NAME;

  const forwardRequest = async (request: Request) => {
    const keyHandler = SyncStateServer.getKeyHandler();

    if (!keyHandler) {
      const namespace = getNamespace(env);
      const id = namespace.idFromName(durableObjectName);
      return namespace.get(id).fetch(request);
    }

    const namespace = getNamespace(env);
    const id = namespace.idFromName(durableObjectName);
    const coordinator = namespace.get(id);
    const proxy = new SyncStateProxy(coordinator, keyHandler);

    return newWorkersRpcResponse(request, proxy);
  };

  return [
    route(basePath, ({ request }) => forwardRequest(request)),
    route(resetPath, ({ request }) => forwardRequest(request)),
  ];
};
