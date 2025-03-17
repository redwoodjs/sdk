import { initClient } from "redwoodsdk/client";

let ws: WebSocket | null = null;

const main = async () => {
  const { setRscPayload } = await initClient();

  const setupWebSocket = () => {
    if (ws) return;

    ws = new WebSocket(`wss://${window.location.host}/__realtime`);

    ws.addEventListener("message", (event) => {
      console.log("[Realtime] New document content received");
      setRscPayload(Promise.resolve({ node: event.data }));
    });

    ws.addEventListener("close", () => {
      console.warn("[Realtime] WebSocket closed, attempting to reconnect...");
      setTimeout(setupWebSocket, 5000);
    });
  };

  setupWebSocket();
};

main();
