import debug from "debug";
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
  log('Phase 1: Worker "Discovery" Pass');
  await builder.build(builder.environments["worker"]!);
  log("✅ Phase 1 complete");

  log("Discovered clientEntryPoints: %O", Array.from(clientEntryPoints));
  log("Discovered clientFiles: %O", Array.from(clientFiles));

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

  log("Phase 3: SSR Build");
  await builder.build(builder.environments.ssr);
  log("✅ Phase 3 complete");

  log("Phase 4: Linker Build Pass");
  await builder.build(builder.environments.linker);
  log("✅ Phase 4 complete");
  log("🚀 Build complete!");
}
