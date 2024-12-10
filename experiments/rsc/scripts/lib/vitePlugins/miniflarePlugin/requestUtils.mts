import { Miniflare, type RequestInit } from "miniflare";
import type { IncomingMessage, ServerResponse } from "node:http";

export const nodeToWebRequest = (req: IncomingMessage, url: URL): Request => {
  return new Request(url.href, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method !== "GET" && req.method !== "HEAD"
        ? (req as unknown as BodyInit)
        : undefined,
    // @ts-ignore
    duplex: "half",
  });
};

export const webToNodeResponse = async (
  webResponse: Response,
  nodeResponse: ServerResponse,
) => {
  // Copy status and headers
  nodeResponse.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => {
    nodeResponse.setHeader(key, value);
  });

  // Stream the response
  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        nodeResponse.write(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  nodeResponse.end();
};

export const dispatchNodeRequestToMiniflare = async ({
  miniflare,
  request,
  response,
}: {
  miniflare: Miniflare;
  request: IncomingMessage;
  response: ServerResponse;
}) => {
  const url = new URL(request.url as string, `http://${request.headers.host}`);
  const webRequest = nodeToWebRequest(request, url);

  // context(justinvdm, 2024-11-19): Type assertions needed because Miniflare's Request and Responses types have additional Cloudflare-specific properties
  const webResponse = await miniflare.dispatchFetch(
    webRequest.url,
    webRequest as RequestInit,
  );

  await webToNodeResponse(webResponse as unknown as Response, response);
};
