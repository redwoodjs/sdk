import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import {
  DEFAULT_SYNCED_STATE_NAME,
  DEFAULT_SYNCED_STATE_PATH,
} from "./constants.mjs";
import type { SyncedStateCoordinator } from "./Coordinator.mjs";

export type SyncedStateRouteOptions = {
  basePath?: string;
  resetPath?: string;
  durableObjectName?: string;
};

export const syncedStateRoutes = (
  getNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<SyncedStateCoordinator>,
  options: SyncedStateRouteOptions = {},
) => {
  const basePath = options.basePath ?? DEFAULT_SYNCED_STATE_PATH;
  const resetPath = options.resetPath ?? `${basePath}/reset`;
  const durableObjectName =
    options.durableObjectName ?? DEFAULT_SYNCED_STATE_NAME;

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
