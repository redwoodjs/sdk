import type { EventContext } from "@cloudflare/workers-types";

const DEV_SERVER_PORT = 5173;

const resolveUrl = (url: string) => {
  const resolvedUrl = new URL(url);
  resolvedUrl.hostname = "localhost";
  resolvedUrl.port = DEV_SERVER_PORT.toString();
  resolvedUrl.hash = `#${Date.now()}`;
  return resolvedUrl;
};

const resolveWorkerUrl = () =>
  new URL(`http://localhost:${DEV_SERVER_PORT}/src/worker.ts#${Date.now()}`).toString()

export default {
  fetch: async (event: EventContext<{}, any, any>) => {
    if (event.request.url.startsWith("/static/")) {
      return fetch(resolveUrl(event.request.url));
    }

    const worker = await import(resolveWorkerUrl());
    return worker.fetch(event);
  },
};