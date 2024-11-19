import type { EventContext } from "@cloudflare/workers-types";
import { CLIENT_DEV_SERVER_PORT, WORKER_DEV_SERVER_PORT } from './constants';

const resolveUrl = (url: string) => {
  const resolvedUrl = new URL(url);
  resolvedUrl.hostname = "localhost";
  resolvedUrl.port = CLIENT_DEV_SERVER_PORT.toString();
  return resolvedUrl;
};

// context(justinvdm, 2024-11-19): `#${Date.now()}` to cache-bust for miniflare runtime cache
const resolveWorkerUrl = () =>
  new URL(`http://localhost:${WORKER_DEV_SERVER_PORT}/src/worker.ts#${Date.now()}`).toString()

export default {
  fetch: async (event: EventContext<{}, any, any>) => {
    if (event.request.url.startsWith("/static/")) {
      return fetch(resolveUrl(event.request.url));
    }

    const worker = await import(resolveWorkerUrl());
    return worker.fetch(event);
  },
};