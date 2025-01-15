import express from "express";
import { Miniflare, MiniflareOptions } from "miniflare";
import { resolve } from "node:path";
import { readdir } from "fs/promises";

import { miniflareConfig } from "./configs/miniflare.mjs";
import {
  DEV_SERVER_PORT,
  DIST_DIR,
  ROOT_DIR,
} from "./lib/constants.mjs";
import {
  nodeToWebRequest,
  webToNodeResponse,
} from "./lib/vitePlugins/requestUtils.mjs";
import { readFile } from "fs/promises";
import { $ } from './lib/$.mjs';

const setup = async () => {
  const miniflare = new Miniflare({
    ...miniflareConfig,
    script: "",
  } as MiniflareOptions);

  if (!process.env.NO_BUILD) {
    await $`pnpm wrangler build`
    console.log("Wrangler build complete!");
  }

  const distFiles = await readdir(DIST_DIR);
  const wasmFiles = distFiles.filter(file => file.endsWith('.wasm'));

  await miniflare.setOptions({
    ...miniflareConfig,
    modules: [
      {
        type: "ESModule" as const,
        path: resolve(DIST_DIR, "worker.js"),
        contents: await readFile(resolve(DIST_DIR, "worker.js"), "utf-8"),
      },
      ...await Promise.all(wasmFiles.map(async (file) => ({
        type: "CompiledWasm" as const,
        path: resolve(DIST_DIR, file),
        contents: await readFile(resolve(DIST_DIR, file)),
      }))),
    ],
  });

  return { miniflare };
};

const createServers = async () => {
  const { miniflare } = await setup();
  const app = express();

  app.use("/assets", express.static(resolve(DIST_DIR, "assets")));

  app.use(async (req, res) => {
    try {
      const webRequest = nodeToWebRequest(req);
      const webResponse = await miniflare.dispatchFetch(
        webRequest.url,
        webRequest,
      );
      await webToNodeResponse(webResponse, res);
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
    console.log(`\
🚀 Preview server ready!
⭐️ Local: http://localhost:${DEV_SERVER_PORT}
`);
  });
};

createServers();
