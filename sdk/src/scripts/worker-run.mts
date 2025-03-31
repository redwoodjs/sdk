import { resolve } from "path";
import { writeFile } from "fs/promises";
import { unstable_readConfig } from "wrangler";
import { createServer as createViteServer } from "vite";
import tmp from "tmp-promise";
import lockfile from "proper-lockfile";

import { redwood } from "../vite/index.mjs";
import { findWranglerConfig } from "../lib/findWranglerConfig.mjs";
import { ROOT_DIR } from "../lib/constants.mjs";

const LOCK_PATH = resolve(ROOT_DIR, ".worker-run.lock");

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

  const workerConfigPath = await findWranglerConfig(process.cwd());

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

  // context(justinvdm, 27 Mar 2025): If worker scripts are run concurrently, they'll
  // all using the same port for the inspector port (there is currently no way to override the port number).
  // Simply waiting for the port to be open will cause a stampede of retries, so we use a lockfile to mitigate this.
  const releaseLock = await lockfile.lock(LOCK_PATH, {
    retries: {
      retries: 100,
      factor: 1.2,
      minTimeout: 200,
      maxTimeout: 1000,
      randomize: true,
    },
    stale: 30000,
  });

  try {
    await writeFile(
      tmpWorkerPath.path,
      JSON.stringify(scriptWorkerConfig, null, 2),
    );

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

    try {
      await server.listen();
      const address = server.httpServer?.address();

      if (!address || typeof address === "string") {
        throw new Error("Dev server address is invalid");
      }

      await fetch(`http://localhost:${address.port}/`);
    } finally {
      await server.close();
    }
  } finally {
    await tmpWorkerPath.cleanup();
    await releaseLock();
  }
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runWorkerScript(process.argv[2]);
}
