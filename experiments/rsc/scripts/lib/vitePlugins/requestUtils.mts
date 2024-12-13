import { Miniflare, type RequestInit } from "miniflare";
import type { IncomingMessage, ServerResponse } from "node:http";

type MiniflareResponse = Awaited<
  ReturnType<typeof Miniflare.prototype.dispatchFetch>
>;

export const nodeToWebRequest = (
  req: IncomingMessage,
): Request & RequestInit => {
  const url = new URL(req.url as string, `http://${req.headers.host}`);

  return new Request(url.href, {
    method: req.method,
    headers: req.headers as HeadersInit,
    body:
      req.method !== "GET" && req.method !== "HEAD"
        ? (req as unknown as BodyInit)
        : undefined,
    // @ts-ignore
    duplex: "half",
  }) as Request & RequestInit;
};

export const webToNodeResponse = async (
  webResponse: Response | MiniflareResponse,
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
