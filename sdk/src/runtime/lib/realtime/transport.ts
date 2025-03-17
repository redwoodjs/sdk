import { Transport } from "../../client";

export const realtimeTransport: Transport = ({ setRscPayload }) => {
  let ws: WebSocket | null = null;

  const realtimeCallServer = async <Result>(
    id: string | null,
    args: unknown[],
  ) => {
    // todo
  };

  const setupWebSocket = () => {
    if (ws) return;

    ws = new WebSocket(`wss://${window.location.host}/__realtime`);

    ws.addEventListener("message", (event) => {
      console.log("[Realtime] New document content received");
    });

    ws.addEventListener("message", (event) => {
      console.log("[Realtime] New document content received");
      setRscPayload(/* todo */);
    });

    ws.addEventListener("close", () => {
      console.warn("[Realtime] WebSocket closed, attempting to reconnect...");
      setTimeout(setupWebSocket, 5000);
    });
  };

  setupWebSocket();

  return realtimeCallServer;
};
