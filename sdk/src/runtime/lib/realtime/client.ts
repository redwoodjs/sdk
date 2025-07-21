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

    const setupWebSocket = () => {
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

      ws.addEventListener("message", (event) => {
        const data = new Uint8Array(event.data);
        const messageType = data[0];

        if (messageType === MESSAGE_TYPE.RSC_START) {
          const decoder = new TextDecoder();
          const rscId = decoder.decode(data.slice(2, 38)); // Extract RSC stream ID

          const stream = new ReadableStream({
            start(controller) {
              ws!.addEventListener("message", function streamHandler(event) {
                const data = new Uint8Array(event.data);
                const messageType = data[0];

                // Extract the RSC stream ID and verify it matches
                const responseId = decoder.decode(data.slice(1, 37));
                if (responseId !== rscId) {
                  return; // Not for this stream
                }

                const payload = data.slice(37);

                if (messageType === MESSAGE_TYPE.RSC_CHUNK) {
                  controller.enqueue(payload);
                } else if (messageType === MESSAGE_TYPE.RSC_END) {
                  controller.close();
                  ws!.removeEventListener("message", streamHandler);
                }
              });
            },
          });

          const rscPayload = createFromReadableStream(stream, {
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

    const realtimeCallServer = async <Result>(
      id: string | null,
      args: unknown[],
    ): Promise<Result | null> => {
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

        return new Promise(async (resolve, reject) => {
          const stream = new ReadableStream({
            start(controller) {
              const messageHandler = (event: MessageEvent) => {
                const data = new Uint8Array(event.data);
                const messageType = data[0];
                const decoder = new TextDecoder();
                let responseId;

                if (messageType === MESSAGE_TYPE.ACTION_START) {
                  responseId = decoder.decode(data.slice(2, 38));
                  if (responseId !== requestId) {
                    return;
                  }
                  // Start message received, do nothing further with this message.
                  // The stream is now ready for chunks.
                } else {
                  // Handle CHUNK, END, ERROR
                  responseId = decoder.decode(data.slice(1, 37));
                  if (responseId !== requestId) {
                    return;
                  }

                  const payload = data.slice(37);

                  if (messageType === MESSAGE_TYPE.ACTION_CHUNK) {
                    controller.enqueue(payload);
                  } else if (messageType === MESSAGE_TYPE.ACTION_END) {
                    controller.close();
                    socket.removeEventListener("message", messageHandler);
                  } else if (messageType === MESSAGE_TYPE.ACTION_ERROR) {
                    const errorJson = decoder.decode(payload);
                    let errorMsg = "Unknown error";
                    try {
                      const errorObj = JSON.parse(errorJson);
                      errorMsg = errorObj.error || errorMsg;
                    } catch (e) {
                      // Use default error message
                    }
                    controller.error(new Error(errorMsg));
                    socket.removeEventListener("message", messageHandler);
                  }
                }
              };
              socket.addEventListener("message", messageHandler);
            },
          });

          const rscPayload = createFromReadableStream(stream, {
            callServer: realtimeCallServer,
          });
          transportContext.setRscPayload(
            rscPayload as Promise<ActionResponse<unknown>>,
          );
          try {
            const result = await rscPayload;
            resolve((result as { actionResult: Result }).actionResult);
          } catch (rscPayloadError) {
            reject(rscPayloadError);
          }
        });
      } catch (e) {
        console.error("[Realtime] Error calling server", e);
        return null;
      }
    };

    setupWebSocket();

    return realtimeCallServer;
  };
