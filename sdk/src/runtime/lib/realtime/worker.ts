import { route } from "../../entries/router";
import { validateUpgradeRequest } from "./validateUpgradeRequest";
import type { RealtimeDurableObject } from "./durableObject";

export const realtimeRoute = (
  getDurableObjectNamespace: (
    env: Env,
  ) => DurableObjectNamespace<RealtimeDurableObject>,
) =>
  route("/__realtime", async function ({ request, env }) {
    const validation = validateUpgradeRequest(request);

    if (!validation.valid) {
      return validation.response;
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "default";

    const id = getDurableObjectNamespace(env).idFromName(key);
    const durableObject = getDurableObjectNamespace(env).get(id);

    return durableObject.fetch(request);
  });
