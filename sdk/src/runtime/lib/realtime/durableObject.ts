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
  storage: DurableObjectStorage;
  clientInfoCache: Map<string, ClientInfo>;

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.storage = state.storage;
    this.clientInfoCache = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const validation = validateUpgradeRequest(request);

    if (!validation.valid) {
      return validation.response;
    }

    const url = new URL(request.url);
    const clientInfo = this.createClientInfo(url, request);
    return this.handleWebSocket(request, clientInfo);
  }

  private createClientInfo(url: URL, request: Request): ClientInfo {
    return {
      url: url.searchParams.get("url")!,
      clientId: url.searchParams.get("clientId")!,
      cookieHeaders: request.headers.get("Cookie") || "",
    };
  }

  private async storeClientInfo(clientInfo: ClientInfo): Promise<void> {
    this.clientInfoCache.set(clientInfo.clientId, clientInfo);
    await this.storage.put(`client:${clientInfo.clientId}`, clientInfo);
  }

  private async getClientInfo(clientId: string): Promise<ClientInfo> {
    const cachedInfo = this.clientInfoCache.get(clientId);
    if (cachedInfo) {
      return cachedInfo;
    }

    const clientInfo = await this.storage.get<ClientInfo>(`client:${clientId}`);
    if (!clientInfo) {
      throw new Error(`Client info not found for clientId: ${clientId}`);
    }

    this.clientInfoCache.set(clientId, clientInfo);
    return clientInfo;
  }

  private async handleWebSocket(
    request: Request,
    clientInfo: ClientInfo,
  ): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    await this.storeClientInfo(clientInfo);
    server.serializeAttachment(clientInfo.clientId);
    this.state.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, data: ArrayBuffer) {
    const clientId = ws.deserializeAttachment() as string;
    const clientInfo = await this.getClientInfo(clientId);

    const message = new Uint8Array(data);
    const messageType = message[0];

    if (messageType === MESSAGE_TYPE.ACTION_REQUEST) {
      const decoder = new TextDecoder();
      const jsonData = decoder.decode(message.slice(1));
      const { id, args, requestId, clientUrl } = JSON.parse(jsonData);

      try {
        await this.handleAction(ws, id, args, clientInfo, requestId, clientUrl);
      } catch (error) {
        const encoder = new TextEncoder();
        const requestIdBytes = encoder.encode(requestId);

        const errorData = JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        });
        const errorBytes = encoder.encode(errorData);

        const errorResponse = new Uint8Array(
          1 + requestIdBytes.length + errorBytes.length,
        );
        errorResponse[0] = MESSAGE_TYPE.ACTION_ERROR;
        errorResponse.set(requestIdBytes, 1);
        errorResponse.set(errorBytes, 1 + requestIdBytes.length);

        ws.send(errorResponse);
      }
    }
  }

  private async streamResponse(
    response: Response,
    ws: WebSocket,
    messageTypes: {
      chunk: number;
      end: number;
    },
    streamId: string,
  ): Promise<void> {
    const reader = response.body!.getReader();
    const encoder = new TextEncoder();
    const streamIdBytes = encoder.encode(streamId);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const endMessage = new Uint8Array(1 + streamIdBytes.length);
          endMessage[0] = messageTypes.end;
          endMessage.set(streamIdBytes, 1);
          ws.send(endMessage);
          break;
        }

        const chunkMessage = new Uint8Array(
          1 + streamIdBytes.length + value.length,
        );
        chunkMessage[0] = messageTypes.chunk;
        chunkMessage.set(streamIdBytes, 1);
        chunkMessage.set(value, 1 + streamIdBytes.length);
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
    requestId: string,
    clientUrl: string,
  ): Promise<void> {
    const url = new URL(clientUrl);
    url.searchParams.set("__rsc", "");

    if (id != null) {
      url.searchParams.set("__rsc_action_id", id);
    }

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

    this.render({
      exclude: [clientInfo.clientId],
    });

    await this.streamResponse(
      response,
      ws,
      {
        chunk: MESSAGE_TYPE.ACTION_CHUNK,
        end: MESSAGE_TYPE.ACTION_END,
      },
      requestId,
    );
  }

  private async determineSockets({
    include = [],
    exclude = [],
  }: {
    include?: string[];
    exclude?: string[];
  } = {}): Promise<Array<{ socket: WebSocket; clientInfo: ClientInfo }>> {
    const sockets = Array.from(this.state.getWebSockets());
    const includeSet = include.length > 0 ? new Set(include) : null;
    const excludeSet = exclude.length > 0 ? new Set(exclude) : null;
    const results: Array<{ socket: WebSocket; clientInfo: ClientInfo }> = [];

    for (const socket of sockets) {
      const clientId = socket.deserializeAttachment() as string;

      if (excludeSet?.has(clientId)) {
        continue;
      }

      if (includeSet && !includeSet.has(clientId)) {
        continue;
      }

      const clientInfo = await this.getClientInfo(clientId);
      results.push({ socket, clientInfo });
    }

    return results;
  }

  public async render({
    include,
    exclude,
  }: {
    include?: string[];
    exclude?: string[];
  } = {}): Promise<void> {
    const sockets = await this.determineSockets({ include, exclude });
    if (sockets.length === 0) return;

    await Promise.all(
      sockets.map(async ({ socket, clientInfo }) => {
        try {
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

          const rscId = crypto.randomUUID();

          const startMessage = new Uint8Array(1 + 36);
          startMessage[0] = MESSAGE_TYPE.RSC_START;
          startMessage.set(new TextEncoder().encode(rscId), 1);
          socket.send(startMessage);

          await this.streamResponse(
            response,
            socket,
            {
              chunk: MESSAGE_TYPE.RSC_CHUNK,
              end: MESSAGE_TYPE.RSC_END,
            },
            rscId,
          );
        } catch (err) {
          console.error("Failed to process socket:", err);
        }
      }),
    );
  }

  private async removeClientInfo(clientId: string): Promise<void> {
    this.clientInfoCache.delete(clientId);
    await this.storage.delete(`client:${clientId}`);
  }

  async webSocketClose(ws: WebSocket) {
    const clientId = ws.deserializeAttachment() as string;
    await this.removeClientInfo(clientId);
  }
}
