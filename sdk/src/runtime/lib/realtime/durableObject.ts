import { DurableObject } from "cloudflare:workers";

interface ClientInfo {
  url: string;
  clientId: string;
}

export class RealtimeDurableObject extends DurableObject {
  state: DurableObjectState;
  env: Env;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      const url = new URL(request.url);
      const clientInfo = this.createClientInfo(url);
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
    server.serializeAttachment(clientInfo);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketOpen(ws: WebSocket) {
    const clientInfo = ws.deserializeAttachment() as ClientInfo;
    console.log(
      `Client connected - ID: ${clientInfo.clientId}, URL: ${clientInfo.url}`,
    );
  }

  async webSocketMessage(ws: WebSocket, event: any) {
    console.log("######### message", event);
    const clientInfo = ws.deserializeAttachment() as ClientInfo;
    const message = JSON.parse(event.data.toString());

    if (message.type === "action:request") {
      try {
        const result = await this.handleAction(
          message.id,
          message.args,
          clientInfo,
        );

        ws.send(
          JSON.stringify({
            type: "action:response",
            id: message.id,
            result,
          }),
        );
      } catch (error) {
        ws.send(
          JSON.stringify({
            type: "action:response",
            id: message.id,
            error: `${error}`,
          }),
        );
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const clientInfo = ws.deserializeAttachment() as ClientInfo;
    console.log(
      `Client disconnected - ID: ${clientInfo.clientId}, URL: ${clientInfo.url}, Code: ${code}, Reason: ${reason}`,
    );
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
    for (const socket of this.state.getWebSockets()) {
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
