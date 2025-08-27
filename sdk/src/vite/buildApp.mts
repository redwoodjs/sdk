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
  // This builds the main worker code, discovers client entry points and
  // 'use client' modules, and leaves placeholders for assets.
  log('Phase 1: Worker "Discovery" Pass');
  await builder.build(builder.environments["worker"]!);
  log("✅ Phase 1 complete");

  log("Discovered clientEntryPoints: %O", Array.from(clientEntryPoints));
  log("Discovered clientFiles: %O", Array.from(clientFiles));

  // Phase 2: Client Build
  // This builds the client-side assets, using the entry points
  // discovered in Phase 1. It produces the final, hashed asset files
  // and a manifest.json.
  log("Phase 2: Client Build");
  const clientEnv = builder.environments["client"]!;
  clientEnv.config.build ??= {} as any;
  clientEnv.config.build.rollupOptions ??= {};
  const clientEntryPointsArray = Array.from(clientEntryPoints);

  if (clientEntryPointsArray.length === 0) {
    log("No client entry points discovered, using default: src/client.tsx");
    clientEnv.config.build.rollupOptions.input = ["src/client.tsx"];
  } else {
    clientEnv.config.build.rollupOptions.input = clientEntryPointsArray;
  }

  await builder.build(clientEnv);
  log("✅ Phase 2 complete");

  // Phase 3: SSR Build
  // This builds the SSR versions of all the 'use client' components
  // discovered in Phase 1.
  log("Phase 3: SSR Build");
  const ssrEnv = builder.environments["ssr"]!;
  ssrEnv.config.build ??= {} as any;
  ssrEnv.config.build.rollupOptions ??= {};
  const clientFilesArray = Array.from(clientFiles);

  if (clientFilesArray.length === 0) {
    log("No client files discovered, SSR build will use default configuration");
  } else {
    log("Setting SSR entry points from client files: %o", clientFilesArray);
    ssrEnv.config.build.rollupOptions.input = clientFilesArray;
  }

  await builder.build(ssrEnv);
  log("✅ Phase 3 complete");

  // Intermission: Prepare for the final linking phase
  // We need to copy the manifest and the SSR artifacts into the final
  // worker output directory so the linker can find them.
  log("Preparing for final link phase...");

  const manifestPath = path.resolve(
    projectRootDir,
    "dist",
    "client",
    ".vite",
    "manifest.json",
  );

  await fsp.copyFile(manifestPath, WORKER_MANIFEST_PATH);
  log("  Copied manifest to %s", WORKER_MANIFEST_PATH);

  const ssrArtifacts = await fsp.readdir(SSR_OUTPUT_DIR);
  for (const file of ssrArtifacts) {
    await fsp.copyFile(
      path.join(SSR_OUTPUT_DIR, file),
      path.join(WORKER_OUTPUT_DIR, file),
    );
  }
  log(
    "  Copied %d SSR artifacts to worker output directory",
    ssrArtifacts.length,
  );

  // Phase 4: Linker Build Pass
  // This is the final assembly step. It uses a minimal environment to
  // bundle the intermediate worker.js, the SSR artifacts, and the client
  // manifest into a single, deployable worker. A custom plugin handles
  // the replacement of asset placeholders.
  log("Phase 4: Linker Build Pass");
  await builder.build(builder.environments["linker"]!);
  log("✅ Phase 4 complete");
  log("🚀 Build complete!");
}
