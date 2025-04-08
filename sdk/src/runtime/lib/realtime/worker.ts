import { route } from "../../entries/router";
import { validateUpgradeRequest } from "./validateUpgradeRequest";
import type { RealtimeDurableObject } from "./durableObject";
import { DEFAULT_REALTIME_KEY } from "./constants";
import { requestContext } from "../../requestInfo/worker";
import { env } from "cloudflare:workers";

export { renderRealtimeClients } from "./renderRealtimeClients";

export const realtimeRoute = (
  getDurableObjectNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<RealtimeDurableObject>,
) =>
  route("/__realtime", async function () {
    const { request } = requestContext;
    const validation = validateUpgradeRequest(request);

    if (!validation.valid) {
      return validation.response;
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key") || DEFAULT_REALTIME_KEY;

    const id = getDurableObjectNamespace(env).idFromName(key);
    const durableObject = getDurableObjectNamespace(env).get(id);

    return durableObject.fetch(request);
  });
