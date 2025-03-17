import { createFromReadableStream } from "react-server-dom-webpack/client.browser";
import { Transport, type ActionResponse } from "../../client";

export const realtimeTransport: Transport = ({ setRscPayload }) => {
  let ws: WebSocket | null = null;
  let promisedConnectionReady: Promise<void>;

  const ensureWs = async (): Promise<WebSocket> => {
    if (!ws) {
      setupWebSocket();
    }
    await promisedConnectionReady;
    return ws!;
  };

  const setupWebSocket = () => {
    if (ws) return;

    const { promise, resolve: resolveConnectionReady } =
      Promise.withResolvers<void>();

    promisedConnectionReady = promise;

    ws = new WebSocket(`wss://${window.location.host}/__realtime`);

    ws.addEventListener("open", () => {
      resolveConnectionReady();
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
      setTimeout(setupWebSocket, 5000);
    });
  };

  const realtimeCallServer = async <Result>(
    id: string | null,
    args: unknown[],
  ): Promise<Result> => {
    const { encodeReply } = await import(
      "react-server-dom-webpack/client.browser"
    );

    const socket = await ensureWs();

    const message = {
      type: "action:request",
      id,
      args: args != null ? await encodeReply(args) : null,
    };
    socket.send(JSON.stringify(message));

    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        const data = JSON.parse(event.data);
        if (data.type === "action:response" && data.id === id) {
          socket.removeEventListener("message", messageHandler);
          resolve(data.result);
        }
      };
      socket.addEventListener("message", messageHandler);
    });
  };

  setupWebSocket();

  return realtimeCallServer;
};
