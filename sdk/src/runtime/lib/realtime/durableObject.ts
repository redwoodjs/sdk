import { DurableObject } from "cloudflare:workers";
import {
  ActionChunkMessage,
  ActionEndMessage,
  ActionRequestMessage,
  ActionStartMessage,
  packMessage,
  RscChunkMessage,
  RscEndMessage,
  RscStartMessage,
  unpackMessage,
} from "./protocol";
import { MESSAGE_TYPE } from "./shared";
import { validateUpgradeRequest } from "./validateUpgradeRequest";

interface ClientInfo {
  url: string;
  clientId: string;
  cookieHeaders: string;
  shouldForwardResponses: boolean;
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
      shouldForwardResponses:
        url.searchParams.get("shouldForwardResponses") === "true",
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
    let clientInfo = await this.getClientInfo(clientId);

    const unpacked = unpackMessage(new Uint8Array(data));

    if (unpacked.type === MESSAGE_TYPE.ACTION_REQUEST) {
      const message = unpacked as ActionRequestMessage;
      clientInfo = {
        ...clientInfo,
        url: message.clientUrl,
      };

      await this.storeClientInfo(clientInfo);

      try {
        await this.handleAction(
          ws,
          message.id,
          message.args,
          clientInfo,
          message.requestId,
          message.clientUrl,
        );
      } catch (error) {
        ws.send(
          packMessage({
            type: MESSAGE_TYPE.ACTION_ERROR,
            id: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }

  private async streamResponse(
    response: Response,
    ws: WebSocket,
    messageTypes: {
      start: number;
      chunk: number;
      end: number;
    },
    streamId: string,
  ): Promise<void> {
    const startMessage: ActionStartMessage | RscStartMessage =
      messageTypes.start === MESSAGE_TYPE.ACTION_START
        ? {
            type: MESSAGE_TYPE.ACTION_START,
            id: streamId,
            status: response.status,
          }
        : {
            type: MESSAGE_TYPE.RSC_START,
            id: streamId,
            status: response.status,
          };

    ws.send(packMessage(startMessage));

    const reader = response.body!.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          const endMessage: ActionEndMessage | RscEndMessage =
            messageTypes.end === MESSAGE_TYPE.ACTION_END
              ? { type: MESSAGE_TYPE.ACTION_END, id: streamId }
              : { type: MESSAGE_TYPE.RSC_END, id: streamId };
          ws.send(packMessage(endMessage));
          break;
        }
        const chunkMessage: ActionChunkMessage | RscChunkMessage =
          messageTypes.chunk === MESSAGE_TYPE.ACTION_CHUNK
            ? {
                type: MESSAGE_TYPE.ACTION_CHUNK,
                id: streamId,
                payload: value,
              }
            : {
                type: MESSAGE_TYPE.RSC_CHUNK,
                id: streamId,
                payload: value,
              };
        ws.send(packMessage(chunkMessage));
      }
    } finally {
      reader.releaseLock();
    }
  }

  private async handleAction(
    ws: WebSocket,
    id: string | null,
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

    if (!response.ok && !clientInfo.shouldForwardResponses) {
      throw new Error(`Action failed: ${response.statusText}`);
    }

    this.render({
      exclude: [clientInfo.clientId],
    });

    await this.streamResponse(
      response,
      ws,
      {
        start: MESSAGE_TYPE.ACTION_START,
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

          await this.streamResponse(
            response,
            socket,
            {
              start: MESSAGE_TYPE.RSC_START,
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
