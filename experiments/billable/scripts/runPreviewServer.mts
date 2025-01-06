import express from "express";
import { Miniflare, MiniflareOptions } from "miniflare";
import { resolve } from "node:path";

import { miniflareConfig } from "./configs/miniflare.mjs";
import {
  DEV_SERVER_PORT,
  DIST_DIR,
  WORKER_DIST_DIR,
} from "./lib/constants.mjs";
import {
  dispatchNodeRequestToMiniflare,
  nodeToWebRequest,
  webToNodeResponse,
} from "./lib/vitePlugins/requestUtils.mjs";
import { build } from "./build.mjs";
import { readFile } from "fs/promises";

const setup = async () => {
  const miniflare = new Miniflare({
    ...miniflareConfig,
    script: "",
  } as MiniflareOptions);

  if (!process.env.NO_BUILD) {
    await build();
  }

  const bundles = [
    {
      type: "ESModule" as const,
      path: resolve(WORKER_DIST_DIR, "worker.js"),
      contents: await readFile(resolve(WORKER_DIST_DIR, "worker.js"), "utf-8"),
    },
  ];

  await miniflare.setOptions({
    ...miniflareConfig,
    modules: bundles,
  });

  return { miniflare };
};

const createServers = async () => {
  // context(justinvdm, 2024-11-28): We don't need to wait for the initial bundle builds to complete before starting the dev server, we only need to have this complete by the first request
  const promisedSetupComplete = new Promise(setImmediate).then(setup);
  const app = express();

  app.use("/assets", express.static(resolve(DIST_DIR, "assets")));

  app.use(async (req, res) => {
    try {
      const { miniflare } = await promisedSetupComplete;
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
    const { miniflare } = await promisedSetupComplete;
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
