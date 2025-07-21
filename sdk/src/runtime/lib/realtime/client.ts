import { initClient, type Transport, type ActionResponse } from "../../client";
import { createFromReadableStream } from "react-server-dom-webpack/client.browser";
import { MESSAGE_TYPE } from "./shared";
const DEFAULT_KEY = "default";

export const initRealtimeClient = ({
  key = DEFAULT_KEY,
  handleResponse,
}: { key?: string; handleResponse?: (response: Response) => boolean } = {}) => {
  const transport = realtimeTransport({ key });
  return initClient({ transport, handleResponse });
};

export const realtimeTransport =
  ({
    key = DEFAULT_KEY,
    handleResponse,
  }: {
    key?: string;
    handleResponse?: (response: Response) => boolean;
  }): Transport =>
  (transportContext) => {
    let ws: WebSocket | null = null;
    let isConnected = false;
    const clientId = crypto.randomUUID();

    const clientUrl = new URL(window.location.href);
    const isHttps = clientUrl.protocol === "https:";
    clientUrl.protocol = "";
    clientUrl.host = "";

    const setupWebSocket = async () => {
      if (ws) return;

      const protocol = isHttps ? "wss" : "ws";

      ws = new WebSocket(
        `${protocol}://${window.location.host}/__realtime?` +
          `key=${encodeURIComponent(key)}&` +
          `url=${encodeURIComponent(clientUrl.toString())}&` +
          `clientId=${encodeURIComponent(clientId)}&` +
          `shouldForwardResponses=${encodeURIComponent(handleResponse ? "true" : "false")}`,
      );

      ws.binaryType = "arraybuffer";

      ws.addEventListener("open", () => {
        isConnected = true;
      });

      ws.addEventListener("error", (event) => {
        console.error("[Realtime] WebSocket error", event);
      });

      ws.addEventListener("message", async (event) => {
        const data = new Uint8Array(event.data);
        const messageType = data[0];

        if (messageType === MESSAGE_TYPE.RSC_START) {
          const decoder = new TextDecoder();
          const rscId = decoder.decode(data.slice(2, 38));

          const response = await createResponseFromSocket(rscId, ws!, {
            start: MESSAGE_TYPE.RSC_START,
            chunk: MESSAGE_TYPE.RSC_CHUNK,
            end: MESSAGE_TYPE.RSC_END,
          });

          const rscPayload = createFromReadableStream(response.body!, {
            callServer: realtimeCallServer,
          }) as Promise<ActionResponse<unknown>>;

          transportContext.setRscPayload(rscPayload);
        }
      });

      ws.addEventListener("close", () => {
        console.warn("[Realtime] WebSocket closed, attempting to reconnect...");
        ws = null;
        isConnected = false;
        setTimeout(setupWebSocket, 5000);
      });
    };

    const ensureWs = (): WebSocket => {
      if (!ws && isConnected) {
        throw new Error(
          "Inconsistent state: WebSocket is null but marked as connected",
        );
      }
      if (!ws || !isConnected) {
        throw new Error("WebSocket is not connected");
      }
      return ws;
    };

    const realtimeCallServer = async <T>(
      id: string | null,
      args: unknown[],
    ): Promise<T | null> => {
      try {
        const socket = ensureWs();
        const { encodeReply } = await import(
          "react-server-dom-webpack/client.browser"
        );

        // Note(peterp, 2025-07-02): We need to send the "current URL" per message,
        // in case the user has enabled client side navigation.
        const clientUrl = new URL(window.location.href);
        clientUrl.protocol = "";
        clientUrl.host = "";

        const encodedArgs = args != null ? await encodeReply(args) : null;
        const requestId = crypto.randomUUID();
        const messageData = JSON.stringify({
          id,
          args: encodedArgs,
          requestId,
          clientUrl,
        });

        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(messageData);
        const message = new Uint8Array(messageBytes.length + 1);
        message[0] = MESSAGE_TYPE.ACTION_REQUEST;
        message.set(messageBytes, 1);

        socket.send(message);

        try {
          const response = await createResponseFromSocket(requestId, socket, {
            start: MESSAGE_TYPE.ACTION_START,
            chunk: MESSAGE_TYPE.ACTION_CHUNK,
            end: MESSAGE_TYPE.ACTION_END,
            error: MESSAGE_TYPE.ACTION_ERROR,
          });

          let streamForRsc: ReadableStream<Uint8Array>;
          let shouldContinue = true;

          if (transportContext.handleResponse) {
            const [stream1, stream2] = response.body!.tee();
            const clonedResponse = new Response(stream1, response);
            streamForRsc = stream2;
            shouldContinue = transportContext.handleResponse(clonedResponse);
          } else {
            streamForRsc = response.body!;
          }

          if (!shouldContinue) {
            return undefined as unknown as T;
          }

          const rscResponse = (await createFromReadableStream(streamForRsc!, {
            callServer: realtimeCallServer as any,
          })) as { actionResult: T };
          return rscResponse.actionResult;
        } catch (err) {
          throw err;
        }
      } catch (e) {
        console.error("[Realtime] Error calling server", e);
        return null;
      }
    };

    setupWebSocket();

    return realtimeCallServer;
  };

function createResponseFromSocket(
  id: string,
  socket: WebSocket,
  messageTypes: {
    start: number;
    chunk: number;
    end: number;
    error?: number;
  },
): Promise<Response> {
  return new Promise((resolve) => {
    let streamController: ReadableStreamDefaultController<Uint8Array> | null =
      null;

    const handler = (event: MessageEvent) => {
      const data = new Uint8Array(event.data);
      const messageType = data[0];
      const decoder = new TextDecoder();
      const responseId = decoder.decode(data.slice(1, 37));

      if (responseId !== id) {
        return;
      }

      if (messageType === messageTypes.start) {
        const stream = new ReadableStream({
          start(controller) {
            streamController = controller;
          },
        });

        const status = data[1];
        const response = new Response(stream, {
          status,
          headers: { "Content-Type": "text/plain" },
        });

        resolve(response);
      } else if (streamController) {
        if (messageType === messageTypes.chunk) {
          const payload = data.slice(37);
          streamController.enqueue(payload);
        } else if (messageType === messageTypes.end) {
          streamController.close();
          socket.removeEventListener("message", handler);
        } else if (messageTypes.error && messageType === messageTypes.error) {
          const payload = data.slice(37);
          const errorJson = decoder.decode(payload);
          let errorMsg = "Unknown error";
          try {
            const errorObj = JSON.parse(errorJson);
            errorMsg = errorObj.error || errorMsg;
          } catch (e) {
            //
          }
          streamController.error(new Error(errorMsg));
          socket.removeEventListener("message", handler);
        }
      }
    };

    socket.addEventListener("message", handler);
  });
}
