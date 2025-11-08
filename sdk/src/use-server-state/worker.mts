import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import type { SyncStateCoordinator } from "./Coordinator.mjs";
import { DEFAULT_SYNC_STATE_PATH } from "./constants.mjs";

export {
  registerGetStateCallback,
  registerSetStateCallback,
} from "./Coordinator.mjs";

export type SyncStateRouteOptions = {
  basePath?: string;
  resetPath?: string;
  durableObjectName?: string;
};

const DEFAULT_SYNC_STATE_NAME = "syncedState";

/**
 * Registers routes that forward sync state requests to the configured Durable Object namespace.
 * @param getNamespace Function that returns the Durable Object namespace from the Worker env.
 * @param options Optional overrides for base path, reset path, and object name.
 * @returns Router entries for the sync state API and reset endpoint.
 */
export const syncStateRoutes = (
  getNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<SyncStateCoordinator>,
  options: SyncStateRouteOptions = {},
) => {
  const basePath = options.basePath ?? DEFAULT_SYNC_STATE_PATH;
  const resetPath = options.resetPath ?? `${basePath}/reset`;
  const durableObjectName =
    options.durableObjectName ?? DEFAULT_SYNC_STATE_NAME;

  const forwardRequest = (request: Request) => {
    const namespace = getNamespace(env);
    const id = namespace.idFromName(durableObjectName);
    return namespace.get(id).fetch(request);
  };

  return [
    route(basePath, ({ request }) => forwardRequest(request)),
    route(resetPath, ({ request }) => forwardRequest(request)),
  ];
};
