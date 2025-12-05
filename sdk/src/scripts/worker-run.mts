import crypto from "crypto";
import dbg from "debug";
import getPort from "get-port";
import path from "path";
import { pathToFileURL } from "url";
import * as vite from "vite";
import { createLogger } from "vite";

const debug = dbg("rwsdk:worker-run");

const main = async () => {
  process.env.RWSDK_WORKER_RUN = "1";

  const token = crypto.randomBytes(32).toString("hex");
  process.env.VITE_RWSDK_WORKER_RUN_TOKEN = token;

  const relativeScriptPath = process.argv[2];

  if (!relativeScriptPath) {
    console.error("Error: Script path is required");
    console.log("\nUsage:");
    console.log("  rwsdk worker-run <script-path>");
    console.log("\nExamples:");
    console.log("  rwsdk worker-run src/scripts/seed.ts\n");
    process.exit(1);
  }

  const scriptPath = path.resolve(process.cwd(), relativeScriptPath);
  const port = await getPort();

  let server: vite.ViteDevServer | undefined;

  const cleanup = async () => {
    if (server) {
      await server.close();
    }
    process.exit();
  };

  process.on("SIGINT", cleanup);
  process.on("SIGTERM", cleanup);

  try {
    server = await vite.createServer({
      logLevel: "silent",
      build: {
        outDir: ".rwsdk",
      },
      customLogger: createLogger("info", {
        prefix: "[rwsdk]",
        allowClearScreen: true,
      }),
      server: {
        port,
        host: "localhost",
      },
    });

    await server.listen();

    const fileUrl = pathToFileURL(scriptPath).href;
    const url = `http://localhost:${port}/__worker-run?script=${encodeURIComponent(
      fileUrl,
    )}`;
    debug("Fetching %s", url);

    const response = await fetch(url, {
      headers: {
        "x-rwsdk-worker-run-token": token,
      },
    });
    debug("Response from worker: %s", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `Error: worker-run script failed with status ${response.status}.`,
      );
      if (errorText) {
        console.error("Response:", errorText);
      }
      process.exit(1);
    }

    const responseText = await response.text();
    debug("Response from worker: %s", responseText);
  } catch (e: any) {
    console.error("rwsdk: Error running script:\n\n%s", e.message);
    process.exit(1);
  } finally {
    await cleanup();
  }
};

main();
