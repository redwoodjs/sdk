import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import type { RequestInfo } from "../runtime/requestInfo/types";
import { runWithRequestInfo } from "../runtime/requestInfo/worker";
import {
  SyncedStateServerHibernation,
} from "./SyncedStateServerHibernation.mjs";
import { setIdentityInUrl } from "./identity-hibernation.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export { SyncedStateServerHibernation };

export type SyncedStateHibernationRouteOptions = {
  basePath?: string;
  durableObjectName?: string;
};

const DEFAULT_HIBERNATION_STATE_NAME = "syncedStateHibernation";

// context(justinvdm, 19 Jun 2026): The hibernation route hands the browser's
// WebSocket directly to the DO and exits. Room resolution and identity
// extraction happen once at upgrade time in the worker; the DO then uses the
// captured identity to transform keys internally via registerKeyHandler.
export const syncedStateRoutes = (
  getNamespace: (
    env: Cloudflare.Env,
  ) => DurableObjectNamespace<SyncedStateServerHibernation>,
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
    SyncedStateServerHibernation.registerNamespace(namespace, durableObjectName);

    const identityExtractor =
      SyncedStateServerHibernation.getIdentityExtractor();
    const roomHandler = SyncedStateServerHibernation.getRoomHandler();

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

    // Extract a serializable identity from the request context so the DO can
    // run key transformation without keeping the worker alive.
    let identity: unknown = undefined;
    if (identityExtractor) {
      identity = await runWithRequestInfo(
        requestInfo,
        async () => await identityExtractor(requestInfo),
      );
    }

    // Forward the upgrade request to the DO, passing the captured identity in
    // the URL so the DO can store it on the WebSocket attachment.
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
