import express from "express";
import { Miniflare, MiniflareOptions } from "miniflare";
import { resolve } from "node:path";

import { miniflareOptions } from "./lib/configs.mjs";
import {
  DEV_SERVER_PORT,
  DIST_DIR,
  WORKER_DIST_DIR,
} from "./lib/constants.mjs";
import { dispatchNodeRequestToMiniflare } from "./lib/requestUtils.mjs";
import { build } from "./build.mjs";
import { readFile } from "fs/promises";

const setup = async () => {
  const miniflare = new Miniflare({
    ...miniflareOptions,
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
    ...miniflareOptions,
    modules: bundles,
  });

  return { miniflare };
};

const createServers = async () => {
  const promisedSetupComplete = setup();
  const app = express();

  app.use("/assets", express.static(resolve(DIST_DIR, "client", "assets")));

  app.use(async (req, res) => {
    try {
      const { miniflare } = await promisedSetupComplete;

      return await dispatchNodeRequestToMiniflare({
        miniflare,
        request: req,
        response: res,
      });
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
    console.log(`
🚀 Preview server up and running! 🔥
⭐️ Local: http://localhost:${DEV_SERVER_PORT}
`);
  });
};

createServers();
