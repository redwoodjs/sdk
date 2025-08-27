import fsp from "node:fs/promises";
import path from "node:path";
import debug from "debug";
import {
  SSR_OUTPUT_DIR,
  WORKER_OUTPUT_DIR,
  DIST_DIR,
} from "../lib/constants.mjs";

import type { ViteBuilder } from "vite";

const log = debug("rwsdk:vite:build-app");

/**
 * The build orchestrator is responsible for running the multi-phase build
 * process for production. It is designed to solve the circular dependency
 * between the worker, client, and SSR builds.
 *
 * @see docs/architecture/productionBuildProcess.md
 */
export async function buildApp(
  builder: ViteBuilder,
  clientEntryPoints: Set<string>,
  clientFiles: Set<string>,
) {
  // Phase 1: Worker "Discovery" Pass
  console.log('🔍 buildApp started - Phase 1: Worker "Discovery" Pass');
  log('Phase 1: Worker "Discovery" Pass');

  // The worker environment is already configured - just run the build
  await builder.build(builder.environments["worker"]!);

  // Debug: Check what was discovered
  console.log("🔍 Entry Point Discovery Results:");
  console.log("  clientEntryPoints:", Array.from(clientEntryPoints));
  console.log("  clientFiles:", Array.from(clientFiles));
  log("Discovered clientEntryPoints: %O", Array.from(clientEntryPoints));
  log("Discovered clientFiles: %O", Array.from(clientFiles));

  // Phase 2: Client Build
  log("Phase 2: Client Build");

  // Update client config with discovered entry points
  const clientEnv = builder.environments["client"]!;
  if (clientEnv.config.build?.rollupOptions) {
    const entryPoints = Array.from(clientEntryPoints);

    // Safety check: if no entry points discovered, use default
    if (entryPoints.length === 0) {
      log("No client entry points discovered, using default: src/client.tsx");
      clientEnv.config.build.rollupOptions.input = ["src/client.tsx"];
    } else {
      clientEnv.config.build.rollupOptions.input = entryPoints;
    }
  }

  const clientOutput = await builder.build(clientEnv);
  let clientManifest;

  console.log("🔍 Searching for client manifest in build output...");
  console.log(
    "  clientOutput type:",
    Array.isArray(clientOutput) ? "array" : typeof clientOutput,
  );
  console.log("  clientOutput keys:", Object.keys(clientOutput));

  if (Array.isArray(clientOutput)) {
    console.log("  Processing array of outputs, length:", clientOutput.length);
    for (const output of clientOutput) {
      console.log("    Output keys:", Object.keys(output));
      if ("output" in output) {
        console.log(
          "    Searching in output.output, items:",
          output.output.length,
        );
        clientManifest = output.output.find(
          (item: any) =>
            item.type === "asset" && item.fileName === "manifest.json",
        );
        if (clientManifest) {
          console.log("    ✅ Found manifest in array output!");
          break;
        }
      }
    }
  } else if ("output" in clientOutput) {
    console.log(
      "  Searching in single output.output, items:",
      clientOutput.output.length,
    );
    clientManifest = clientOutput.output.find(
      (item: any) => item.type === "asset" && item.fileName === "manifest.json",
    );
    if (clientManifest) {
      console.log("  ✅ Found manifest in single output!");
    }
  }

  if (!clientManifest) {
    console.log("❌ Could not find client manifest!");
    console.log("Available outputs:", JSON.stringify(clientOutput, null, 2));
    throw new Error("Could not find client manifest");
  }

  // Phase 3: SSR Build
  log("Phase 3: SSR Build");

  // Update SSR config with discovered client files
  const ssrEnv = builder.environments["ssr"]!;
  if (
    ssrEnv.config.build?.lib &&
    typeof ssrEnv.config.build.lib === "object" &&
    ssrEnv.config.build.lib.entry
  ) {
    // Add discovered client files to the entry points
    const entryObj = ssrEnv.config.build.lib.entry as Record<string, string>;
    for (const file of clientFiles) {
      entryObj[file] = file;
    }
  }

  await builder.build(ssrEnv);

  // Phase 4: Worker "Reprocessing" Pass
  log('Phase 4: Worker "Reprocessing" Pass');

  // Modify the worker environment to process SSR artifacts
  const workerEnv = builder.environments["worker"]!;

  // Update the worker config to use SSR artifacts as input
  if (workerEnv.config.build?.rollupOptions) {
    // Clear the original input and replace with SSR artifacts
    const entry: Record<string, string> = {};

    const ssrFiles = await fsp.readdir(SSR_OUTPUT_DIR);
    for (const file of ssrFiles) {
      if (file.endsWith(".js") || file.endsWith(".mjs")) {
        const entryName = file.replace(/\.(m?js)$/, "");
        entry[entryName] = path.join(SSR_OUTPUT_DIR, file);
      }
    }

    workerEnv.config.build.rollupOptions.input = entry;

    // Ensure output paths match the external imports from Phase 1
    workerEnv.config.build.rollupOptions.output = {
      ...workerEnv.config.build.rollupOptions.output,
      entryFileNames: (chunkInfo: any) => {
        if (chunkInfo.name.includes("__ssr_bridge")) {
          return "__ssr_bridge.js";
        }
        if (chunkInfo.name.includes("__client_lookup")) {
          return "__client_lookup.mjs";
        }
        if (chunkInfo.name.includes("__server_lookup")) {
          return "__server_lookup.mjs";
        }
        return "[name].mjs";
      },
    };
  }

  await builder.build(workerEnv);

  // Phase 5: Client Asset "Linking" Pass
  log('Phase 5: Client Asset "Linking" Pass');

  const workerJsPath = path.join(WORKER_OUTPUT_DIR, "worker.js");
  const workerJs = await fsp.readFile(workerJsPath, "utf-8");
  const manifest = JSON.parse((clientManifest as any).source);

  let linkedWorkerJs = workerJs;

  for (const [key, value] of Object.entries(manifest)) {
    linkedWorkerJs = linkedWorkerJs.replaceAll(
      `rwsdk_asset:${key}`,
      `/${(value as { file: string }).file}`,
    );
  }

  await fsp.writeFile(workerJsPath, linkedWorkerJs);
}
