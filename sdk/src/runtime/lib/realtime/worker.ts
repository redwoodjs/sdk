import { route } from "../../entries/router";
import type { DurableObject } from "cloudflare:workers";

export const realtimeRoute = (
  durableObjectNamespace: DurableObjectNamespace<DurableObject>,
) =>
  route("/__realtime", async function ({ request }) {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const url = new URL(request.url);
    const key = url.searchParams.get("key") || "default";

    const id = durableObjectNamespace.idFromName(key);
    const durableObject = durableObjectNamespace.get(id);

    return durableObject.fetch(request);
  });
