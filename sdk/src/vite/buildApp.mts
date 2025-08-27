import fsp from "node:fs/promises";
import path from "node:path";
import debug from "debug";
import {
  SSR_OUTPUT_DIR,
  WORKER_OUTPUT_DIR,
  WORKER_MANIFEST_PATH,
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
export async function buildApp({
  builder,
  clientEntryPoints,
  clientFiles,
  projectRootDir,
}: {
  builder: ViteBuilder;
  clientEntryPoints: Set<string>;
  clientFiles: Set<string>;
  projectRootDir: string;
}) {
  // Phase 1: Worker "Discovery" Pass
  log('🔍 buildApp started - Phase 1: Worker "Discovery" Pass');
  log('Phase 1: Worker "Discovery" Pass');

  // The worker environment is already configured - just run the build
  await builder.build(builder.environments["worker"]!);

  // Debug: Check what was discovered
  log("🔍 Entry Point Discovery Results:");
  log("  clientEntryPoints:", Array.from(clientEntryPoints));
  log("  clientFiles:", Array.from(clientFiles));
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

  await builder.build(clientEnv);

  const manifestPath = path.resolve(
    projectRootDir,
    "client",
    ".vite",
    "manifest.json",
  );
  let clientManifest;

  log("📖 Reading client manifest from %s", manifestPath);
  try {
    const manifestContent = await fsp.readFile(manifestPath, "utf-8");
    await new Promise((resolve) => setTimeout(resolve, 1000));
    clientManifest = { source: manifestContent };
    log("  ✅ Successfully read manifest from filesystem");
  } catch (error) {
    log("  ❌ Failed to read manifest: %s", error);
  }

  if (!clientManifest) {
    log("❌ rwsdk: Could not find client manifest!");
    throw new Error("rwsdk: Could not find client manifest");
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

  // Copy manifest.json to worker output directory for external import resolution
  await fsp.writeFile(WORKER_MANIFEST_PATH, (clientManifest as any).source);
  log("📄 Copied manifest to %s", WORKER_MANIFEST_PATH);

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
