import { DurableObject } from "cloudflare:workers";
import { MESSAGE_TYPE } from "./shared";
import { validateUpgradeRequest } from "./validateUpgradeRequest";

interface ClientInfo {
  url: string;
  clientId: string;
  cookieHeaders: string;
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
    const validation = validateUpgradeRequest(request);

    if (!validation.valid) {
      return validation.response;
    }

    const url = new URL(request.url);

    if (
      request.headers.get("Upgrade") === "websocket" &&
      request.headers.get("Origin") === url.origin
    ) {
      const clientInfo = this.createClientInfo(url, request);
      return this.handleWebSocket(request, clientInfo);
    }

    return new Response("Invalid request", { status: 400 });
  }

  private createClientInfo(url: URL, request: Request): ClientInfo {
    return {
      url: url.searchParams.get("url")!,
      clientId: url.searchParams.get("clientId")!,
      cookieHeaders: request.headers.get("Cookie") || "",
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
        await this.handleAction(ws, id, args, clientInfo);
      } catch (error) {
        const errorData = JSON.stringify({
          id,
          error: error instanceof Error ? error.message : String(error),
        });
        const encoder = new TextEncoder();
        const errorBytes = encoder.encode(errorData);

        const errorResponse = new Uint8Array(errorBytes.length + 1);
        errorResponse[0] = MESSAGE_TYPE.ACTION_ERROR;
        errorResponse.set(errorBytes, 1);

        ws.send(errorResponse);
      }
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    const clientInfo = ws.deserializeAttachment() as ClientInfo;
    console.log(
      `Client disconnected - ID: ${clientInfo.clientId}, URL: ${clientInfo.url}, Code: ${code}, Reason: ${reason}`,
    );
  }

  private async streamResponse(
    response: Response,
    ws: WebSocket,
    messageTypes: {
      chunk: number;
      end: number;
    },
  ): Promise<void> {
    const reader = response.body!.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          ws.send(new Uint8Array([messageTypes.end]));
          break;
        }

        const chunkMessage = new Uint8Array(value.length + 1);
        chunkMessage[0] = messageTypes.chunk;
        chunkMessage.set(value, 1);
        ws.send(chunkMessage);
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async handleAction(
    ws: WebSocket,
    id: string,
    args: string,
    clientInfo: ClientInfo,
  ): Promise<void> {
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
        Cookie: clientInfo.cookieHeaders,
      },
    });

    if (!response.ok) {
      throw new Error(`Action failed: ${response.statusText}`);
    }

    const broadcastStream = response.clone().body;
    this.broadcastRSCUpdate(broadcastStream!, ws);

    await this.streamResponse(response, ws, {
      chunk: MESSAGE_TYPE.ACTION_CHUNK,
      end: MESSAGE_TYPE.ACTION_END,
    });
  }

  private async broadcastRSCUpdate(
    rscPayload: ReadableStream,
    currentSocket: WebSocket,
  ): Promise<void> {
    const sockets = Array.from(this.state.getWebSockets()).filter(
      (socket) => socket !== currentSocket,
    );

    if (sockets.length === 0) return;

    await Promise.all(
      sockets.map(async (socket) => {
        try {
          const clientInfo = socket.deserializeAttachment() as ClientInfo;
          const url = new URL(clientInfo.url);
          url.searchParams.set("__rsc", "true");

          const response = await fetch(url.toString(), {
            headers: {
              "Content-Type": "application/json",
              Cookie: clientInfo.cookieHeaders,
            },
          });

          if (!response.ok) {
            console.error(`Failed to fetch RSC update: ${response.statusText}`);
            return;
          }

          socket.send(new Uint8Array([MESSAGE_TYPE.RSC_START]));
          await this.streamResponse(response, socket, {
            chunk: MESSAGE_TYPE.RSC_CHUNK,
            end: MESSAGE_TYPE.RSC_END,
          });
        } catch (err) {
          console.error("Failed to process socket:", err);
        }
      }),
    );
  }
}
