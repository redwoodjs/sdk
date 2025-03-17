import { DurableObject } from "cloudflare:workers";

export class RealtimeDurableObject extends DurableObject {
  state: DurableObjectState;
  env: Env;
  connections: Set<WebSocket>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.connections = new Set();
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    return new Response("Invalid request", { status: 400 });
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    this.acceptWebSocket(server);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  private async acceptWebSocket(webSocket: WebSocket): Promise<void> {
    webSocket.accept();
    this.connections.add(webSocket);

    webSocket.addEventListener("message", async (event) => {
      const message = JSON.parse(event.data.toString());

      if (message.type === "action:request") {
        try {
          const result = await this.handleAction(message.id, message.args);

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

    webSocket.addEventListener("close", () => {
      this.connections.delete(webSocket);
    });
  }

  private async handleAction(id: string, args: any[]): Promise<any> {
    // todo(justinvdm, 2025-03-17): implement
    return null;
  }

  private async broadcastRSCUpdate(rscPayload: ReadableStream): Promise<void> {
    for (const socket of this.connections) {
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

  public async updateRSC(newContent: any): Promise<void> {
    const rscStream = await this.generateRSCStream(newContent);
    this.broadcastRSCUpdate(rscStream);
  }

  private async generateRSCStream(content: any): Promise<ReadableStream> {
    // todo(justinvdm, 2025-03-17): implement
    return new ReadableStream({
      start(controller) {
        controller.enqueue(content);
        controller.close();
      },
    });
  }
}
