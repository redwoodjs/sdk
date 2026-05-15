import debug from "debug";
import { existsSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { ViteBuilder } from "vite";
import { INTERMEDIATES_OUTPUT_DIR } from "../lib/constants.mjs";
import { ConfigurableEsbuildOptions, runDirectivesScan } from "./runDirectivesScan.mjs";

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
  esbuildOptions,
}: {
  builder: ViteBuilder;
  clientEntryPoints: Set<string>;
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  projectRootDir: string;
  workerEntryPathname: string;
  esbuildOptions: ConfigurableEsbuildOptions;
}) {
  await rm(resolve(projectRootDir, "dist"), { recursive: true, force: true });

  const workerEnv = builder.environments.worker;

  // Run a pre-scan build pass to allow plugins to set up and generate code
  // before scanning.
  console.log("Running plugin setup pass...");
  process.env.RWSDK_BUILD_PASS = "plugin-setup";

  const tempEntryPath = resolve(INTERMEDIATES_OUTPUT_DIR, "temp-entry.js");

  try {
    if (!existsSync(dirname(tempEntryPath))) {
      await mkdir(dirname(tempEntryPath), { recursive: true });
    }
    await writeFile(tempEntryPath, "");

    // context(justinvdm, 2026-05-13): Mutate the resolved build config in
    // place rather than replacing the build object. Creating a new object
    // loses Vite's rolldownOptions compat proxy, so we save and restore
    // individual properties instead.
    const originalWrite = workerEnv.config.build.write;
    const originalInput = workerEnv.config.build.rolldownOptions.input;
    workerEnv.config.build.write = false;
    workerEnv.config.build.rolldownOptions.input = {
      index: tempEntryPath,
    };

    await builder.build(workerEnv);

    // Restore the original config
    workerEnv.config.build.write = originalWrite;
    workerEnv.config.build.rolldownOptions.input = originalInput;
  } finally {
    await rm(tempEntryPath, { force: true });
  }

  await runDirectivesScan({
    rootConfig: builder.config,
    environments: builder.environments,
    clientFiles,
    serverFiles,
    entries: [workerEntryPathname],
    esbuildOptions,
  });

  // context(justinvdm, 2026-05-13): In Vite 8 (Rolldown), the worker build
  // fragments into hundreds of tiny chunks by default. Disabling code
  // splitting forces a single consolidated intermediate worker file, matching
  // the architecture's expectation of an intermediate `worker.js` and
  // preventing leftover artifacts from cluttering the final output.
  workerEnv.config.build.rolldownOptions.output ??= {};
  if (Array.isArray(workerEnv.config.build.rolldownOptions.output)) {
    workerEnv.config.build.rolldownOptions.output.forEach(
      (o: any) => (o.codeSplitting = false),
    );
  } else {
    (workerEnv.config.build.rolldownOptions.output as any).codeSplitting =
      false;
  }

  console.log("Building worker...");
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
  clientEnv.config.build.rolldownOptions ??= {};
  const clientEntryPointsArray = Array.from(clientEntryPoints);

  if (clientEntryPointsArray.length === 0) {
    log("No client entry points discovered, using default: src/client.tsx");
    clientEnv.config.build.rolldownOptions.input = ["src/client.tsx"];
  } else {
    clientEnv.config.build.rolldownOptions.input = clientEntryPointsArray;
  }

  await builder.build(clientEnv);

  console.log("Linking worker build...");
  process.env.RWSDK_BUILD_PASS = "linker";

  // Re-configure the worker environment for the linking pass
  const workerConfig = workerEnv.config;
  workerConfig.build.emptyOutDir = false;

  // context(justinvdm, 22 Sep 2025): This is a workaround to satisfy the
  // Cloudflare plugin's expectation of an entry chunk named `index`. The plugin
  // now manages the worker build, so we no longer set rollup options
  // directly. Instead, we re-point the original entry to the intermediate
  // worker bundle from the first pass. This allows the linker pass to re-use
  // the same plugin-driven configuration while bundling the final worker.
  workerConfig.build.rolldownOptions.input = {
    index: resolve(projectRootDir, "dist", "worker", "index.js"),
  };

  // context(justinvdm, 2026-05-13): In Vite 8 (Rolldown), the linker pass
  // was producing hundreds of tiny chunks instead of a single consolidated
  // worker bundle. Setting codeSplitting:false forces all code (including
  // dynamic imports from the intermediate worker artifact) into the entry
  // chunk, restoring the single-file worker output the architecture expects.
  workerConfig.build.rolldownOptions.output ??= {};
  if (Array.isArray(workerConfig.build.rolldownOptions.output)) {
    workerConfig.build.rolldownOptions.output.forEach(
      (o: any) => (o.codeSplitting = false),
    );
  } else {
    (workerConfig.build.rolldownOptions.output as any).codeSplitting = false;
  }

  await builder.build(workerEnv);

  // Remove first-pass JS artifacts that are now inlined into the final worker
  // bundle. Without this cleanup, ~480 leftover chunks from the first pass
  // clutter dist/worker/assets/ and inflate deployment file counts.
  const workerAssetsDir = resolve(projectRootDir, "dist", "worker", "assets");
  try {
    for (const entry of await readdir(workerAssetsDir)) {
      if (entry.endsWith(".js") || entry.endsWith(".js.map")) {
        await rm(join(workerAssetsDir, entry), { force: true });
      }
    }
  } catch {
    // Directory may not exist (e.g. if the app has no worker assets)
  }

  console.log("Build complete!");

  // context(zshannon, 16 Mar 2026): Nest client output under base subdirectory
  // for Cloudflare's assets module, which maps URL paths directly to file paths.
  const base = builder.config.base || "/";
  if (base !== "/") {
    const subdir = base.replace(/^\/|\/$/g, "");
    const clientDir = resolve(projectRootDir, "dist", "client");
    const tmpDir = resolve(projectRootDir, "dist", "_client_tmp");
    const nestDir = join(clientDir, subdir);

    await rm(tmpDir, { force: true, recursive: true });
    await cp(clientDir, tmpDir, { recursive: true });
    await rm(clientDir, { force: true, recursive: true });
    await mkdir(nestDir, { recursive: true });

    for (const entry of await readdir(tmpDir)) {
      await cp(join(tmpDir, entry), join(nestDir, entry), { recursive: true });
    }
    await rm(tmpDir, { force: true, recursive: true });

    // context(justinvdm, 17 Mar 2026): The Cloudflare Vite plugin generates a
    // wrangler.json in the dist output. We need to patch its assets.directory
    // to account for the nesting we just did.
    const workerDistDir = resolve(projectRootDir, "dist", "worker");
    const wranglerCandidates = ["wrangler.json", "wrangler.jsonc", "wrangler.toml"];
    for (const candidate of wranglerCandidates) {
      const wranglerPath = join(workerDistDir, candidate);
      if (existsSync(wranglerPath) && candidate !== "wrangler.toml") {
        const content = await readFile(wranglerPath, "utf-8");
        const wrangler = JSON.parse(content);
        if (wrangler.assets?.directory) {
          const currentDir = wrangler.assets.directory;
          const fixedDir = currentDir.replace(`/${subdir}`, "");
          if (fixedDir !== currentDir) {
            wrangler.assets.directory = fixedDir;
            await writeFile(wranglerPath, JSON.stringify(wrangler, null, 2));
          } else {
            console.warn(
              `Warning: ${candidate} assets.directory "${currentDir}" ` +
                `did not contain expected "/${subdir}" segment`,
            );
          }
        }
        break;
      }
    }

    console.log(`Nested client assets under ${subdir}/`);
  }
}
