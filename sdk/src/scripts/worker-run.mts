import { resolve } from "path";
import { writeFile } from "fs/promises";
import { unstable_readConfig } from "wrangler";
import { createServer as createViteServer } from "vite";
import tmp from "tmp-promise";
import baseDebug from "debug";

import { redwood } from "../vite/index.mjs";
import { findWranglerConfig } from "../lib/findWranglerConfig.mjs";

const debug = baseDebug("rwsdk:worker-run");

export const runWorkerScript = async (relativeScriptPath: string) => {
  if (!relativeScriptPath) {
    console.error("Error: Script path is required");
    console.log("\nUsage:");
    console.log("  pnpm worker:run <script-path>");
    console.log("\nExample:");
    console.log("  pnpm worker:run src/scripts/seed.ts\n");
    process.exit(1);
  }

  const scriptPath = resolve(process.cwd(), relativeScriptPath);
  debug("Running worker script: %s", scriptPath);

  const workerConfigPath = await findWranglerConfig(process.cwd());
  debug("Using wrangler config: %s", workerConfigPath);

  const workerConfig = unstable_readConfig({
    config: workerConfigPath,
  });

  const tmpWorkerPath = await tmp.file({
    postfix: ".json",
  });
  const scriptWorkerConfig = {
    ...workerConfig,
    configPath: tmpWorkerPath.path,
    userConfigPath: tmpWorkerPath.path,
    main: scriptPath,
  };

  try {
    await writeFile(
      tmpWorkerPath.path,
      JSON.stringify(scriptWorkerConfig, null, 2),
    );
    debug("Worker config written to: %s", tmpWorkerPath.path);

    const server = await createViteServer({
      configFile: false,
      plugins: [
        redwood({
          configPath: tmpWorkerPath.path,
          entry: {
            worker: scriptPath,
          },
        }),
      ],
      server: {
        port: 0,
      },
    });
    debug("Vite server created");

    try {
      await server.listen();
      const address = server.httpServer?.address();
      debug("Server listening on address: %o", address);

      if (!address || typeof address === "string") {
        throw new Error("Dev server address is invalid");
      }

      debug("Fetching worker...");
      await fetch(`http://localhost:${address.port}/`);
      debug("Worker fetched successfully");
    } finally {
      debug("Closing server...");
      await server.close();
      debug("Server closed");
    }
  } finally {
    debug("Closing inspector servers...");
    await tmpWorkerPath.cleanup();
    debug("Temporary files cleaned up");
  }

  // todo(justinvdm, 01 Apr 2025): Investigate what handles are remaining open
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runWorkerScript(process.argv[2]);
}
