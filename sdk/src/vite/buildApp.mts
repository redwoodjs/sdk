import debug from "debug";
import path from "path";
import type { ViteBuilder } from "vite";
import { runDirectivesScan } from "./runDirectivesScan.mjs";
import { normalizeModulePath } from "../lib/normalizeModulePath.mjs";

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
}: {
  builder: ViteBuilder;
  clientEntryPoints: Set<string>;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
}) {
  // The initial scan discovers all possible directive files. The filtering
  // plugin will then narrow this down after the worker build.
  await runDirectivesScan({
    rootConfig: builder.config,
    envName: "worker",
    clientFiles,
    serverFiles,
    projectRootDir,
  });

  console.log("Building worker to discover used client components...");
  await builder.build(builder.environments.worker);

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
  await builder.build(builder.environments.linker);

  console.log("Build complete!");
}
