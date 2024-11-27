import { createBuilder, createServer as createViteServer } from "vite";
import { Miniflare, MiniflareOptions, type RequestInit } from "miniflare";
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolve } from "node:path";
import express from "express";

import { viteConfigs } from "./lib/configs.mjs";
import { prepareDev } from "./prepareDev.mjs";
import { getD1Databases } from "./lib/getD1Databases";
import {
  ASSETS_DIR,
  D1_PERSIST_PATH,
  DEV_SERVER_PORT,
} from "./lib/constants.mjs";

const miniflareOptions: Partial<MiniflareOptions> = {
  // context(justinvdm, 2024-11-21): `npx wrangler d1 migrations apply` creates a sqlite file in `.wrangler/state/v3/d1`
  d1Persist: D1_PERSIST_PATH,
  modules: true,
  compatibilityFlags: [
    "streams_enable_constructors",
    "transformstream_enable_standard_constructor",
    "nodejs_compat",
  ],
  d1Databases: await getD1Databases(),
};

const setup = async () => {
  const rebuildWorker = async () => {
    const result = (await builder.build(builder.environments["worker"])) as {
      output: (
        | {
            type: "asset";
          }
        | {
            type: "chunk";
            fileName: string;
            code: string;
          }
      )[];
    };

    const bundles = result.output
      .filter((output) => output.type === "chunk")
      .map(({ fileName, code }) => ({
        type: "ESModule" as const,
        path: resolve("dist", fileName),
        contents: code,
      }));

    miniflare.setOptions({
      ...miniflareOptions,
      modules: bundles,
    });
  };

  const builder = await createBuilder(
    viteConfigs.dev({
      rebuildWorker,
    }),
  );

  const viteDevServer = await createViteServer(
    viteConfigs.dev({
      rebuildWorker,
    }),
  );

  const miniflare = new Miniflare({
    ...miniflareOptions,
    script: "",
  });
  await rebuildWorker();

  return {
    miniflare,
    viteDevServer,
  };
};

const createServers = async () => {
  await prepareDev();

  const { miniflare } = await setup();

  const app = express();

  app.use("/assets", express.static(ASSETS_DIR));

  app.use(async (req, res) => {
    try {
      const url = new URL(req.url as string, `http://${req.headers.host}`);
      const webRequest = nodeToWebRequest(req, url);

      // context(justinvdm, 2024-11-19): Type assertions needed because Miniflare's Request and Responses types have additional Cloudflare-specific properties
      const webResponse = await miniflare.dispatchFetch(
        webRequest.url,
        webRequest as RequestInit,
      );

      await webToNodeResponse(webResponse as unknown as Response, res);
    } catch (error) {
      console.error("Request handling error:", error);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  process.on("beforeExit", async () => {
    await miniflare.dispose();
  });

  app.listen(DEV_SERVER_PORT, () => {
    console.log(`
🚀 Dev server fired up and ready to rock! 🔥
⭐️ Local: http://localhost:${DEV_SERVER_PORT}
`);
  });
};

const nodeToWebRequest = (req: IncomingMessage, url: URL): Request => {
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

const webToNodeResponse = async (
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

createServers();
