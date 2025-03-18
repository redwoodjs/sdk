import { DurableObject } from "cloudflare:workers";
import { MESSAGE_TYPE } from "./shared";

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

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer) {
    const clientInfo = ws.deserializeAttachment() as ClientInfo;
    const message = new Uint8Array(data);
    const messageType = message[0];

    if (messageType === MESSAGE_TYPE.ACTION_REQUEST) {
      const decoder = new TextDecoder();
      const jsonData = decoder.decode(message.slice(1));
      const { id, args } = JSON.parse(jsonData);

      try {
        const result = await this.handleAction(id, args, clientInfo);

        // Success response
        const responseData = JSON.stringify({ id, result });
        const encoder = new TextEncoder();
        const responseBytes = encoder.encode(responseData);

        const response = new Uint8Array(responseBytes.length + 1);
        response[0] = MESSAGE_TYPE.ACTION_RESPONSE;
        response.set(responseBytes, 1);

        ws.send(response);
      } catch (error) {
        // Error response - using separate message type
        const responseData = JSON.stringify({
          id,
          error: error instanceof Error ? error.message : String(error),
        });
        const encoder = new TextEncoder();
        const responseBytes = encoder.encode(responseData);

        const response = new Uint8Array(responseBytes.length + 1);
        response[0] = MESSAGE_TYPE.ACTION_ERROR;
        response.set(responseBytes, 1);

        ws.send(response);
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
    args: string,
    clientInfo: ClientInfo,
  ): Promise<any> {
    console.log(
      `Handling action for client ${clientInfo.clientId} at ${clientInfo.url}: id: ${id}, args: ${args}`,
    );

    const url = new URL(clientInfo.url);
    url.searchParams.set("__rsc", "true");
    url.searchParams.set("__rsc_action_id", id);

    const response = await fetch(url.toString(), {
      method: "POST",
      body: args,
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Action failed: ${response.statusText}`);
    }

    const responseForStream = response.clone();

    const rscStream = responseForStream.body;

    if (rscStream) {
      await this.broadcastRSCUpdate(rscStream);
    }

    return await response.json();
  }

  private async broadcastRSCUpdate(rscPayload: ReadableStream): Promise<void> {
    const sockets = Array.from(this.state.getWebSockets());

    // Notify all sockets that update is starting
    const startMessage = new Uint8Array([MESSAGE_TYPE.RSC_START]);
    sockets.forEach((socket) => {
      socket.send(startMessage);
    });

    const reader = rscPayload.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // Notify all sockets that we're done
          const endMessage = new Uint8Array([MESSAGE_TYPE.RSC_END]);
          sockets.forEach((socket) => {
            socket.send(endMessage);
          });
          break;
        }

        // Broadcast this chunk to all sockets
        const chunkMessage = new Uint8Array([MESSAGE_TYPE.RSC_CHUNK]);
        const chunkMessageWithPayload = new Uint8Array([
          ...chunkMessage,
          ...value,
        ]);

        sockets.forEach((socket) => {
          try {
            socket.send(chunkMessageWithPayload);
          } catch (err) {
            console.error("Failed to send to socket:", err);
          }
        });
      }
    } finally {
      reader.releaseLock();
    }
  }
}
