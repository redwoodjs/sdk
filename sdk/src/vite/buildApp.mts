import debug from "debug";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
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

    const originalWorkerBuildConfig = workerEnv.config.build;
    workerEnv.config.build = {
      ...originalWorkerBuildConfig,
      write: false,
      rollupOptions: {
        ...originalWorkerBuildConfig?.rollupOptions,
        input: {
          index: tempEntryPath,
        },
      },
    };

    await builder.build(workerEnv);

    // Restore the original config
    workerEnv.config.build = originalWorkerBuildConfig;
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

  // context(zshannon, 16 Mar 2026): Nest client output under base subdirectory
  // for Cloudflare's assets module, which maps URL paths directly to file paths.
  const base = builder.config.base || "/";
  if (base !== "/") {
    const subdir = base.replace(/^\/|\/$/g, "");
    const clientDir = resolve(projectRootDir, "dist", "client");
    const tmpDir = resolve(projectRootDir, "dist", "_client_tmp");
    const nestDir = join(clientDir, subdir);

    rmSync(tmpDir, { force: true, recursive: true });
    cpSync(clientDir, tmpDir, { recursive: true });
    rmSync(clientDir, { force: true, recursive: true });
    mkdirSync(nestDir, { recursive: true });

    for (const entry of readdirSync(tmpDir)) {
      cpSync(join(tmpDir, entry), join(nestDir, entry), { recursive: true });
    }
    rmSync(tmpDir, { force: true, recursive: true });

    const wranglerPath = resolve(
      projectRootDir,
      "dist",
      "worker",
      "wrangler.json",
    );
    if (existsSync(wranglerPath)) {
      const wrangler = JSON.parse(readFileSync(wranglerPath, "utf-8"));
      if (wrangler.assets?.directory) {
        const currentDir = wrangler.assets.directory;
        const fixedDir = currentDir.replace(`/${subdir}`, "");
        if (fixedDir !== currentDir) {
          wrangler.assets.directory = fixedDir;
          writeFileSync(wranglerPath, JSON.stringify(wrangler));
        } else {
          console.warn(
            `Warning: wrangler.json assets.directory "${currentDir}" ` +
              `did not contain expected "/${subdir}" segment`,
          );
        }
      }
    }

    console.log(`Nested client assets under ${subdir}/`);
  }
}
