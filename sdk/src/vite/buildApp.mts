import debug from "debug";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { ViteBuilder } from "vite";
import { runDirectivesScan } from "./runDirectivesScan.mjs";

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
  serverFiles,
  projectRootDir,
  workerEntryPathname,
}: {
  builder: ViteBuilder;
  clientEntryPoints: Set<string>;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
  workerEntryPathname: string;
}) {
  await rm(resolve(projectRootDir, "dist"), { recursive: true, force: true });

  const workerEnv = builder.environments.worker;
  await runDirectivesScan({
    rootConfig: builder.config,
    environments: builder.environments,
    clientFiles,
    serverFiles,
    entries: [workerEntryPathname],
  });

  console.log("Building worker to discover used client components...");
  process.env.RWSDK_BUILD_PASS = "worker";
  await builder.build(workerEnv);

  log(
    "Used client files after worker build & filtering: %O",
    Array.from(clientFiles),
  );

  console.log("Building SSR...");
  await builder.build(builder.environments.ssr);

  log("Discovered clientEntryPoints: %O", Array.from(clientEntryPoints));

  console.log("Building client...");
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

  console.log("Linking worker build...");
  process.env.RWSDK_BUILD_PASS = "linker";

  // Re-configure the worker environment for the linking pass
  const workerConfig = workerEnv.config;
  workerConfig.build!.emptyOutDir = false;

  // context(justinvdm, 22 Sep 2025): This is a workaround to satisfy the
  // Cloudflare plugin's expectation of an entry chunk named `index`. The plugin
  // now manages the worker build, so we no longer set rollup options
  // directly. Instead, we re-point the original entry to the intermediate
  // worker bundle from the first pass. This allows the linker pass to re-use
  // the same plugin-driven configuration while bundling the final worker.
  workerConfig.build!.rollupOptions!.input = {
    index: resolve(projectRootDir, "dist", "worker", "index.js"),
  };

  await builder.build(workerEnv);

  console.log("Build complete!");
}
