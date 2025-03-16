import { DurableObject } from "cloudflare:workers";

export class RealtimeDurableObject extends DurableObject {
  state: DurableObjectState;
  env: any;
  connections: Set<WebSocket>;
  documentContent: string;

  constructor(state: DurableObjectState, env: any) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.connections = new Set();
    this.documentContent = "";
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request);
    }

    if (request.method === "POST") {
      const { content }: { content: string } = await request.json();
      await this.state.blockConcurrencyWhile(async () => {
        this.documentContent = content;
        await this.state.storage.put("document", content);
      });
      this.broadcast(content);
      return new Response("Document updated", { status: 200 });
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

    // Load persisted content
    const storedContent = await this.state.storage.get<string>("document");
    if (storedContent) {
      this.documentContent = storedContent;
      webSocket.send(this.documentContent);
    }

    webSocket.addEventListener("message", async (event) => {
      await this.state.blockConcurrencyWhile(async () => {
        this.documentContent = event.data.toString();
        await this.state.storage.put("document", this.documentContent);
      });
      this.broadcast(this.documentContent);
    });

    webSocket.addEventListener("close", () => {
      this.connections.delete(webSocket);
    });
  }

  private broadcast(content: string): void {
    for (const socket of this.connections) {
      try {
        socket.send(content);
      } catch (err) {
        console.error("Failed to send update:", err);
      }
    }
  }
}
