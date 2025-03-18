import { initClient, type Transport, type ActionResponse } from "../../client";
import { createFromReadableStream } from "react-server-dom-webpack/client.browser";
import { IS_DEV } from "../../constants";
import { MESSAGE_TYPE } from "./shared";
const DEFAULT_KEY = "default";

export const initRealtimeClient = ({
  key = DEFAULT_KEY,
}: { key?: string } = {}) => {
  const transport = realtimeTransport({ key });
  return initClient({ transport });
};

export const realtimeTransport =
  ({ key = DEFAULT_KEY }: { key?: string }): Transport =>
  ({ setRscPayload }) => {
    let ws: WebSocket | null = null;
    let isConnected = false;
    const clientId = crypto.randomUUID();

    const clientUrl = new URL(window.location.href);
    clientUrl.protocol = "";
    clientUrl.host = "";

    const setupWebSocket = () => {
      if (ws) return;

      const protocol = IS_DEV ? "ws" : "wss";

      ws = new WebSocket(
        `${protocol}://${window.location.host}/__realtime?` +
          `key=${encodeURIComponent(key)}&` +
          `url=${encodeURIComponent(clientUrl.toString())}&` +
          `clientId=${encodeURIComponent(clientId)}`,
      );

      ws.binaryType = "arraybuffer";

      ws.addEventListener("open", () => {
        console.log("######### open");
        isConnected = true;
      });

      ws.addEventListener("error", (event) => {
        console.error("[Realtime] WebSocket error", event);
      });

      ws.addEventListener("message", (event) => {
        console.log("######### message", event);
        const data = new Uint8Array(event.data);
        const messageType = data[0];

        if (messageType === MESSAGE_TYPE.RSC_START) {
          console.log("[Realtime] New content stream started");

          const stream = new ReadableStream({
            start(controller) {
              ws!.addEventListener("message", function streamHandler(event) {
                const data = new Uint8Array(event.data);
                const messageType = data[0];

                if (messageType === MESSAGE_TYPE.RSC_CHUNK) {
                  controller.enqueue(data.slice(1));
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

          setRscPayload(rscPayload);
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

        const encodedArgs = args != null ? await encodeReply(args) : null;
        const messageData = JSON.stringify({ id, args: encodedArgs });

        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(messageData);
        const message = new Uint8Array(messageBytes.length + 1);
        message[0] = MESSAGE_TYPE.ACTION_REQUEST;
        message.set(messageBytes, 1);

        socket.send(message);

        return new Promise((resolve, reject) => {
          const messageHandler = (event: MessageEvent) => {
            const data = new Uint8Array(event.data);
            const messageType = data[0];
            const decoder = new TextDecoder();
            const jsonData = decoder.decode(data.slice(1));
            console.log("######### messageHandler", jsonData);
            const response = JSON.parse(jsonData);

            if (response.id === id) {
              socket.removeEventListener("message", messageHandler);

              if (messageType === MESSAGE_TYPE.ACTION_RESPONSE) {
                resolve(response.result);
              } else if (messageType === MESSAGE_TYPE.ACTION_ERROR) {
                reject(new Error(response.error));
              }
            }
          };
          socket.addEventListener("message", messageHandler);
        });
      } catch (e) {
        console.error("[Realtime] Error calling server", e);
        return null;
      }
    };

    setupWebSocket();

    return realtimeCallServer;
  };
