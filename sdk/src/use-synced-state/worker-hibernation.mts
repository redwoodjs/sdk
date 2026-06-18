import { env } from "cloudflare:workers";
import { route } from "../runtime/entries/router";
import type { RequestInfo } from "../runtime/requestInfo/types";
import { runWithRequestInfo } from "../runtime/requestInfo/worker";
import {
  type ClientMessage,
  packMessage,
  unpackClientMessage,
} from "./protocol-hibernation.mjs";
import {
  SyncedStateServerHibernation,
} from "./SyncedStateServerHibernation.mjs";
import { DEFAULT_SYNCED_STATE_PATH } from "./constants.mjs";

export { SyncedStateServerHibernation };

export type SyncedStateHibernationRouteOptions = {
  basePath?: string;
  durableObjectName?: string;
};

const DEFAULT_HIBERNATION_STATE_NAME = "syncedStateHibernation";

// context(justinvdm, 18 Jun 2026): The hibernation route is a stateless WebSocket
// proxy. The browser connects to the worker, the worker opens a second WebSocket
// to the hibernation DO, and every client message has its key transformed by
// registerKeyHandler using the request context captured at upgrade time. This
// lets the DO hibernate while preserving the existing handler API.
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

    const keyHandler = SyncedStateServerHibernation.getKeyHandler();
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

    // Capture a plain snapshot of requestInfo so we can restore async context
    // while transforming keys for messages that arrive after the upgrade handler
    // has returned.
    const capturedRequestInfo: RequestInfo = {
      request: requestInfo.request,
      path: requestInfo.path,
      params: requestInfo.params,
      ctx: requestInfo.ctx,
      rw: requestInfo.rw,
      cf: requestInfo.cf,
      response: requestInfo.response,
      isAction: requestInfo.isAction,
    };

    // Create the client-facing WebSocket.
    const { 0: clientWS, 1: serverWS } = new WebSocketPair();

    // Open a WebSocket to the hibernation DO.
    const doUrl = new URL(request.url);
    doUrl.searchParams.set("clientId", crypto.randomUUID());
    const doRequest = new Request(doUrl.toString(), {
      headers: request.headers,
    });
    const doResponse = await stub.fetch(doRequest);
    const doWS = doResponse.webSocket;
    if (!doWS) {
      return new Response("Failed to connect to sync state DO", { status: 502 });
    }
    doWS.accept();

    // Forward client -> DO, transforming keys with the captured context.
    serverWS.addEventListener("message", async (event) => {
      if (typeof event.data !== "string") {
        return;
      }

      let message: ClientMessage;
      try {
        message = unpackClientMessage(event.data);
      } catch {
        return;
      }

      let storageKey = message.key;
      if (keyHandler) {
        storageKey = await runWithRequestInfo(
          capturedRequestInfo,
          async () => await keyHandler(message.key, stub),
        );
      }

      const proxied: ClientMessage = {
        ...message,
        storageKey,
      };
      doWS.send(packMessage(proxied));
    });

    serverWS.addEventListener("close", () => {
      doWS.close();
    });
    serverWS.addEventListener("error", () => {
      doWS.close();
    });

    // Forward DO -> client unchanged. Messages are already valid envelopes.
    doWS.addEventListener("message", (event) => {
      if (typeof event.data === "string") {
        serverWS.send(event.data);
      }
    });
    doWS.addEventListener("close", () => {
      serverWS.close();
    });
    doWS.addEventListener("error", () => {
      serverWS.close();
    });

    serverWS.accept();

    return new Response(null, { status: 101, webSocket: clientWS });
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
