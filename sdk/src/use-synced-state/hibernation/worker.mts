import { env } from "cloudflare:workers";
import { route } from "../../runtime/entries/router";
import type { RequestInfo } from "../../runtime/requestInfo/types";
import { runWithRequestInfo } from "../../runtime/requestInfo/worker";
import { SyncedStateServer } from "./server.mjs";
import { setIdentityInUrl } from "./identity.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "../constants.mjs";

export { SyncedStateServer };

export type SyncedStateHibernationRouteOptions = {
  basePath?: string;
  durableObjectName?: string;
};

const DEFAULT_HIBERNATION_STATE_NAME = "syncedStateHibernation";

// context(justinvdm, 19 Jun 2026): The route hands the browser's WebSocket
// directly to the DO and exits. Room resolution and identity extraction happen
// once at upgrade time in the worker; the DO then uses the captured identity to
// transform keys internally via registerKeyHandler.
export const syncedStateRoutes = (
  getNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<SyncedStateServer>,
  options: SyncedStateHibernationRouteOptions = {},
) => {
  const basePath = options.basePath ?? DEFAULT_SYNCED_STATE_PATH;
  const durableObjectName =
    options.durableObjectName ?? DEFAULT_HIBERNATION_STATE_NAME;

  const forwardRequest = async (request: Request, requestInfo: RequestInfo) => {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 400 });
    }

    const namespace = getNamespace(env);
    SyncedStateServer.registerNamespace(namespace, durableObjectName);

    const identityExtractor = SyncedStateServer.getIdentityExtractor();
    const roomHandler = SyncedStateServer.getRoomHandler();

    const idParam = requestInfo.params?.id;

    let resolvedRoomName: string;
    if (roomHandler) {
      resolvedRoomName = await runWithRequestInfo(
        requestInfo,
        async () => await roomHandler(idParam, requestInfo),
      );
    } else {
      resolvedRoomName = idParam ?? durableObjectName;
    }

    const id = namespace.idFromName(resolvedRoomName);
    const stub = namespace.get(id);

    let identity: unknown = undefined;
    if (identityExtractor) {
      identity = await runWithRequestInfo(
        requestInfo,
        async () => await identityExtractor(requestInfo),
      );
    }

    const doUrl = new URL(request.url);
    doUrl.searchParams.set("clientId", crypto.randomUUID());
    setIdentityInUrl(identity, doUrl);

    const doRequest = new Request(doUrl.toString(), {
      headers: request.headers,
    });

    return stub.fetch(doRequest);
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
