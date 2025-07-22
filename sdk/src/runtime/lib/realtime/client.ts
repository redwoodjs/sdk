import { initClient, type Transport, type ActionResponse } from "../../client";
import { createFromReadableStream } from "react-server-dom-webpack/client.browser";
import { MESSAGE_TYPE } from "./shared";
const DEFAULT_KEY = "default";

export const initRealtimeClient = ({
  key = DEFAULT_KEY,
  handleResponse,
}: { key?: string; handleResponse?: (response: Response) => boolean } = {}) => {
  const transport = realtimeTransport({ key, handleResponse });
  return initClient({ transport, handleResponse });
};

export const realtimeTransport =
  ({
    key = DEFAULT_KEY,
    handleResponse,
  }: {
    key?: string;
    handleResponse?: (response: Response) => boolean;
  }): Transport =>
  (transportContext) => {
    let ws: WebSocket | null = null;
    let isConnected = false;
    const clientId = crypto.randomUUID();

    const clientUrl = new URL(window.location.href);
    const isHttps = clientUrl.protocol === "https:";
    clientUrl.protocol = "";
    clientUrl.host = "";

    const setupWebSocket = async () => {
      if (ws) return;

      const protocol = isHttps ? "wss" : "ws";

      ws = new WebSocket(
        `${protocol}://${window.location.host}/__realtime?` +
          `key=${encodeURIComponent(key)}&` +
          `url=${encodeURIComponent(clientUrl.toString())}&` +
          `clientId=${encodeURIComponent(clientId)}&` +
          `shouldForwardResponses=${encodeURIComponent(handleResponse ? "true" : "false")}`,
      );

      ws.binaryType = "arraybuffer";

      ws.addEventListener("open", () => {
        isConnected = true;
      });

      ws.addEventListener("error", (event) => {
        console.error("[Realtime] WebSocket error", event);
      });

      ws.addEventListener("close", () => {
        console.warn("[Realtime] WebSocket closed, attempting to reconnect...");
        ws = null;
        isConnected = false;
        setTimeout(setupWebSocket, 5000);
      });

      listenForUpdates(ws!, (response) => {
        processResponse(response);
      });
    };

    const ensureWs = (): WebSocket => {
      if (!ws && isConnected) {
        throw new Error(
          "Inconsistent state: WebSocket is null but marked as connected",
        );
      }
      if (!ws || !isConnected) {
        throw new Error("WebSocket is not connected");
      }
      return ws;
    };

    const realtimeCallServer = async <T>(
      id: string | null,
      args: unknown[],
    ): Promise<T | null> => {
      try {
        const socket = ensureWs();
        const { encodeReply } = await import(
          "react-server-dom-webpack/client.browser"
        );

        // Note(peterp, 2025-07-02): We need to send the "current URL" per message,
        // in case the user has enabled client side navigation.
        const clientUrl = new URL(window.location.href);
        clientUrl.protocol = "";
        clientUrl.host = "";

        const encodedArgs = args != null ? await encodeReply(args) : null;
        const requestId = crypto.randomUUID();
        const messageData = JSON.stringify({
          id,
          args: encodedArgs,
          requestId,
          clientUrl,
        });

        const encoder = new TextEncoder();
        const messageBytes = encoder.encode(messageData);
        const message = new Uint8Array(messageBytes.length + 1);
        message[0] = MESSAGE_TYPE.ACTION_REQUEST;
        message.set(messageBytes, 1);

        const promisedResponse = respondToRequest(requestId, socket);
        socket.send(message);

        return await processResponse(await promisedResponse);
      } catch (e) {
        console.error("[Realtime] Error calling server", e);
        return null;
      }
    };

    const processResponse = async <T>(
      response: Response,
    ): Promise<T | null> => {
      try {
        let streamForRsc: ReadableStream<Uint8Array>;
        let shouldContinue = true;

        if (transportContext.handleResponse) {
          const [stream1, stream2] = response.body!.tee();
          const clonedResponse = new Response(stream1, response);
          streamForRsc = stream2;
          shouldContinue = transportContext.handleResponse(clonedResponse);
        } else {
          streamForRsc = response.body!;
        }

        if (!shouldContinue) {
          return null;
        }

        const rscPayload = createFromReadableStream(streamForRsc!, {
          callServer: realtimeCallServer as any,
        }) as Promise<ActionResponse<unknown>>;

        transportContext.setRscPayload(rscPayload);
        return (await rscPayload).actionResult as T | null;
      } catch (err) {
        throw err;
      }
    };

    setupWebSocket();

    return realtimeCallServer;
  };

function respondToRequest(
  requestId: string,
  socket: WebSocket,
): Promise<Response> {
  const messageTypes = {
    start: MESSAGE_TYPE.ACTION_START,
    chunk: MESSAGE_TYPE.ACTION_CHUNK,
    end: MESSAGE_TYPE.ACTION_END,
    error: MESSAGE_TYPE.ACTION_ERROR,
  };

  return new Promise((resolve, reject) => {
    const handler = (event: MessageEvent) => {
      const data = new Uint8Array(event.data);
      const messageType = data[0];
      const messageRequestId = extractMessageRequestId(
        data,
        messageTypes.start,
      );

      if (messageRequestId !== requestId) {
        return;
      }

      if (messageType === messageTypes.start) {
        socket.removeEventListener("message", handler);

        const status = data[1];

        const stream = createUpdateStreamFromSocket(
          requestId,
          socket,
          messageTypes,
          reject,
        );

        const response = new Response(stream, {
          status,
          headers: { "Content-Type": "text/plain" },
        });

        resolve(response);
      }
    };

    socket.addEventListener("message", handler);
  });
}

function listenForUpdates(
  socket: WebSocket,
  onUpdate: (response: Response) => void,
) {
  const messageTypes = {
    start: MESSAGE_TYPE.RSC_START,
    chunk: MESSAGE_TYPE.RSC_CHUNK,
    end: MESSAGE_TYPE.RSC_END,
  };

  const handler = async (event: MessageEvent) => {
    const data = new Uint8Array(event.data);
    const messageType = data[0];

    if (messageType === messageTypes.start) {
      socket.removeEventListener("message", handler);

      const status = data[1];
      const rscId = extractMessageRequestId(data, messageTypes.chunk);

      const stream = createUpdateStreamFromSocket(
        rscId,
        socket,
        messageTypes,
        (error) => {
          console.error("[Realtime] Error creating update stream", error);
        },
      );

      const response = new Response(stream, {
        status,
        headers: { "Content-Type": "text/plain" },
      });

      onUpdate(response);
    }
  };

  socket.addEventListener("message", handler);
}

const extractMessageRequestId = (data: Uint8Array, messageType: number) => {
  const decoder = new TextDecoder();
  return decoder.decode(
    data.slice(
      messageType === MESSAGE_TYPE.ACTION_START ||
        messageType === MESSAGE_TYPE.RSC_START
        ? 2
        : 1,
      38,
    ),
  );
};

const createUpdateStreamFromSocket = (
  id: string,
  socket: WebSocket,
  messageTypes: {
    chunk: number;
    end: number;
    error?: number;
  },
  onError: (error: Error) => void,
) => {
  let deferredStreamController =
    Promise.withResolvers<ReadableStreamDefaultController<Uint8Array>>();

  const stream = new ReadableStream({
    start(controller) {
      deferredStreamController.resolve(controller);
    },
  });

  const handler = async (event: MessageEvent) => {
    const data = new Uint8Array(event.data);
    const messageType = data[0];
    const messageRequestId = extractMessageRequestId(data, messageType);

    if (messageRequestId !== id) {
      return;
    }

    const streamController = await deferredStreamController.promise;

    const decoder = new TextDecoder();

    if (messageType === messageTypes.chunk) {
      const payload = data.slice(37);
      streamController.enqueue(payload);
    } else if (messageType === messageTypes.end) {
      streamController.close();
      socket.removeEventListener("message", handler);
    } else if (messageTypes.error && messageType === messageTypes.error) {
      const payload = data.slice(37);
      const errorJson = decoder.decode(payload);
      let errorMsg = "Unknown error";
      try {
        const errorObj = JSON.parse(errorJson);
        errorMsg = errorObj.error || errorMsg;
      } catch (e) {
        //
      }
      onError(new Error(errorMsg));
      socket.removeEventListener("message", handler);
    }
  };

  socket.addEventListener("message", handler);

  return stream;
};
