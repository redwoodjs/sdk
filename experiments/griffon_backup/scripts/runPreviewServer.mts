import express from "express";
import { config as dotEnvConfig } from "dotenv";
import { Miniflare, MiniflareOptions } from "miniflare";
import { unstable_readConfig, unstable_getMiniflareWorkerOptions } from "wrangler";
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
  if (!process.env.NO_BUILD) {
    await $({ stdio: "inherit" })`pnpm wrangler deploy --dry-run --outdir=${DIST_DIR}`
    console.log("Wrangler build complete!");
  }

  const config = unstable_readConfig({ config: resolve(ROOT_DIR, "wrangler.toml") }, {});
  const workerOptions = unstable_getMiniflareWorkerOptions(config).workerOptions

  const distFiles = await readdir(DIST_DIR);
  const wasmFiles = distFiles.filter(file => file.endsWith('.wasm'));

  const modules = [
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
  ]

  const miniflare = new Miniflare({
    ...miniflareConfig,
    d1Persist: resolve(ROOT_DIR, ".wrangler/state/v3/d1"),
    r2Persist: resolve(ROOT_DIR, ".wrangler/state/v3/r2"),
    workers: [{
      ...workerOptions,
      bindings: {
        ...workerOptions.bindings,
        ...dotEnvConfig({ path: resolve(ROOT_DIR, ".env") }).parsed,
      },
      modules,
    }]
  } as MiniflareOptions);

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
