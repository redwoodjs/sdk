import { DurableObject } from "cloudflare:workers";

interface ClientInfo {
  url: string;
  clientId: string;
}

export class RealtimeDurableObject extends DurableObject {
  state: DurableObjectState;
  env: Env;
  connections: Map<WebSocket, ClientInfo>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.connections = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      const url = new URL(request.url);
      const clientId = url.searchParams.get("clientId");

      let clientInfo: ClientInfo;
      const stored = await this.state.storage.get(`client:${clientId}`);
      if (stored) {
        clientInfo = stored as ClientInfo;
        clientInfo.url = url.searchParams.get("url") || "/";
      } else {
        clientInfo = this.createClientInfo(url);
      }

      await this.state.storage.put(`client:${clientInfo.clientId}`, clientInfo);

      return this.handleWebSocket(request, clientInfo);
    }

    return new Response("Invalid request", { status: 400 });
  }

  private createClientInfo(url: URL): ClientInfo {
    return {
      url: url.searchParams.get("url")!,
      clientId: url.searchParams.get("clientId")!,
    };
  }

  private async handleWebSocket(
    request: Request,
    clientInfo: ClientInfo,
  ): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.acceptWebSocket(server, clientInfo);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async acceptWebSocket(
    webSocket: WebSocket,
    clientInfo: ClientInfo,
  ): Promise<void> {
    this.connections.set(webSocket, clientInfo);
    console.log(
      `Client connected - ID: ${clientInfo.clientId}, URL: ${clientInfo.url}`,
    );

    webSocket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data.toString());

      if (message.type === "action:request") {
        try {
          const result = await this.handleAction(
            message.id,
            message.args,
            clientInfo,
          );

          webSocket.send(
            JSON.stringify({
              type: "action:response",
              id: message.id,
              result,
            }),
          );
        } catch (error) {
          webSocket.send(
            JSON.stringify({
              type: "action:response",
              id: message.id,
              error: `${error}`,
            }),
          );
        }
      }
    });

    webSocket.addEventListener("close", async () => {
      console.log(`Client disconnected - ID: ${clientInfo.clientId}`);
      this.connections.delete(webSocket);
      await this.state.storage.put(`client:${clientInfo.clientId}`, clientInfo);
    });
  }

  private async handleAction(
    id: string,
    args: any[],
    clientInfo: ClientInfo,
  ): Promise<any> {
    console.log(
      `Handling action for client ${clientInfo.clientId} at ${clientInfo.url}`,
    );

    const url = new URL(clientInfo.url);
    url.searchParams.set("__rsc", "true");
    url.searchParams.set("__rsc_action_id", id);

    const response = await fetch(url.toString(), {
      method: "POST",
      body: JSON.stringify(args),
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Action failed: ${response.statusText}`);
    }

    const rscStream = response.body;
    if (rscStream) {
      await this.broadcastRSCUpdate(rscStream);
    }

    return await response.json();
  }

  private async broadcastRSCUpdate(rscPayload: ReadableStream): Promise<void> {
    for (const socket of this.connections.keys()) {
      try {
        socket.send(JSON.stringify({ type: "rsc:update" }));

        const reader = rscPayload.getReader();
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            socket.send(JSON.stringify({ type: "rsc:end" }));
            break;
          }

          socket.send(
            JSON.stringify({
              type: "rsc:chunk",
              payload: value,
            }),
          );
        }
      } catch (err) {
        console.error("Failed to send RSC update:", err);
      }
    }
  }
}
