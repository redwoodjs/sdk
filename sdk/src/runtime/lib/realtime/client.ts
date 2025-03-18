import {
  fetchTransport,
  initClient,
  type Transport,
  type ActionResponse,
} from "../../client";
import { createFromReadableStream } from "react-server-dom-webpack/client.browser";
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

    const fetchCallServer = fetchTransport({ setRscPayload });

    const clientUrl = new URL(window.location.href);
    clientUrl.protocol = "";
    clientUrl.host = "";

    const setupWebSocket = () => {
      if (ws) return;

      ws = new WebSocket(
        `wss://${window.location.host}/__realtime?` +
          `key=${encodeURIComponent(key)}&` +
          `url=${encodeURIComponent(clientUrl.toString())}&` +
          `clientId=${encodeURIComponent(clientId)}`,
      );

      ws.addEventListener("open", () => {
        isConnected = true;
      });

      ws.addEventListener("message", (event) => {
        const data = JSON.parse(event.data);

        if (data.type === "rsc:update") {
          console.log("[Realtime] New content stream started");

          const stream = new ReadableStream({
            start(controller) {
              ws!.addEventListener("message", function streamHandler(event) {
                const chunk = JSON.parse(event.data);

                if (chunk.type === "rsc:chunk") {
                  controller.enqueue(chunk.payload);
                } else if (chunk.type === "rsc:end") {
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
    ): Promise<Result> => {
      try {
        const socket = ensureWs();
        const { encodeReply } = await import(
          "react-server-dom-webpack/client.browser"
        );

        const message = {
          type: "action:request",
          id,
          args: args != null ? await encodeReply(args) : null,
        };

        socket.send(JSON.stringify(message));

        return new Promise((resolve, reject) => {
          const messageHandler = (event: MessageEvent) => {
            const data = JSON.parse(event.data);
            if (data.type === "action:response" && data.id === id) {
              socket.removeEventListener("message", messageHandler);
              if (data.error) {
                reject(new Error(data.error));
              } else {
                resolve(data.result);
              }
            }
          };
          socket.addEventListener("message", messageHandler);
        });
      } catch {
        return (await fetchCallServer(id, args)) as Result;
      }
    };

    setupWebSocket();

    return realtimeCallServer;
  };
