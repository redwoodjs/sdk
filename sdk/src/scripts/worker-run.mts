import path from "path";
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
    console.log("  npm run worker:run <script-path>");
    console.log("\nExample:");
    console.log("  npm run worker:run src/scripts/seed.ts\n");
    process.exit(1);
  }

  const scriptPath = resolve(process.cwd(), relativeScriptPath);
  debug("Running worker script: %s", scriptPath);

  const workerConfigPath = await findWranglerConfig(process.cwd());
  debug("Using wrangler config: %s", workerConfigPath);

  const workerConfig = unstable_readConfig({
    config: workerConfigPath,
  });

  const workerEntryRelativePath = workerConfig.main;

  const workerEntryPath =
    workerEntryRelativePath ?? path.join(process.cwd(), "src/worker.tsx");

  const tmpDir = await tmp.dir({
    prefix: "rw-worker-run-",
    unsafeCleanup: true,
  });

  const relativeTmpWorkerEntryPath = "worker.tsx";
  const tmpWorkerPath = path.join(tmpDir.path, "wrangler.json");
  const tmpWorkerEntryPath = path.join(tmpDir.path, relativeTmpWorkerEntryPath);

  const scriptWorkerConfig = {
    ...workerConfig,
    configPath: tmpWorkerPath,
    userConfigPath: tmpWorkerPath,
    main: relativeTmpWorkerEntryPath,
  };

  try {
    await writeFile(tmpWorkerPath, JSON.stringify(scriptWorkerConfig, null, 2));
    await writeFile(
      tmpWorkerEntryPath,
      `
export * from "${workerEntryPath}";
export { default } from "${scriptPath}";
`,
    );

    debug("Worker config written to: %s", tmpWorkerPath);
    debug("Worker entry written to: %s", tmpWorkerEntryPath);

    process.env.RWSDK_WORKER_RUN = "1";

    const server = await createViteServer({
      configFile: false,
      plugins: [
        redwood({
          configPath: tmpWorkerPath,
          includeCloudflarePlugin: true,
          entry: {
            worker: tmpWorkerEntryPath,
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
    debug("Temporary files cleaned up");
  }

  // todo(justinvdm, 01 Apr 2025): Investigate what handles are remaining open
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runWorkerScript(process.argv[2]);
}
