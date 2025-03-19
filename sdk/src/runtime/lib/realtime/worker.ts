import { route } from "../../entries/router";
import type { RealtimeDurableObject } from "./durableObject";

export const realtimeRoute = (
  getDurableObjectNamespace: (
    env: Env,
  ) => DurableObjectNamespace<RealtimeDurableObject>,
) =>
  route("/__realtime", async function ({ request, env }) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const url = new URL(request.url);

    if (request.headers.get("Origin") !== url.origin) {
      return new Response("Invalid origin", { status: 403 });
    }

    const key = url.searchParams.get("key") || "default";

    const id = getDurableObjectNamespace(env).idFromName(key);
    const durableObject = getDurableObjectNamespace(env).get(id);

    return durableObject.fetch(request);
  });
