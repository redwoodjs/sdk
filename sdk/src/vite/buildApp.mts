import { spawn } from "node:child_process";
import debug from "debug";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import v8 from "node:v8";
import type { ViteBuilder } from "vite";
import { INTERMEDIATES_OUTPUT_DIR } from "../lib/constants.mjs";
import {
  ConfigurableEsbuildOptions,
  runDirectivesScan,
} from "./runDirectivesScan.mjs";

const log = debug("rwsdk:vite:build-app");

// context(justinvdm, 22 Apr 2026): Hybrid in-process / subprocess build.
//
// Vite/Rollup retains the parsed module graph (acorn AST + scope analysis +
// chunk IR + magic-string buffers) on the BuildEnvironment object after
// `builder.build()` returns. Across the 5 phases of our production build the
// retention stacks: each phase inherits the prior phases' graph as baseline
// memory. For larger consumer apps that stack pushes the worker SSR / client
// phase's own working set past Node's default ~2 GB old-gen heap cap on
// `ubuntu-latest`, and the build OOMs.
//
// The architecture (productionBuildProcess.md) requires that the linker pass
// reuse the *same* worker Vite environment object as worker pass 1, because
// @cloudflare/vite-plugin and our lookup-map plugins depend on cross-phase
// plugin instance state. SSR and Client passes don't have this requirement —
// their inputs (filtered clientFiles, serverFiles, clientEntryPoints) are
// explicit Sets of file paths, and their outputs are file-based artifacts.
//
// So we keep worker pass 1 + linker in-process (architecture-required), and
// run SSR + Client as isolated subprocesses (in parallel) in between. Each
// subprocess gets its own ~150 MB Node heap baseline and doesn't stack on
// the parent's worker-pass retention.
//
// State is exchanged via a JSON file at dist/.rwsdk/build-state.json. The
// parent writes filtered Sets after worker pass 1; SSR and Client children
// load them at start of buildApp.
//
// Opt-out: RWSDK_SUBPROCESS_BUILD=0 falls back to the fully in-process build.
const SUBPROCESS_OPT_OUT = process.env.RWSDK_SUBPROCESS_BUILD === "0";
const STATE_FILE = process.env.RWSDK_STATE_FILE;
const PHASE_ONLY = process.env.RWSDK_PHASE;

// Memory instrumentation — opt-in via RWSDK_MEM_TRACE=1. Useful for
// diagnosing OOMs in consumer builds. Use with `node --expose-gc` to get
// retained-after-gc snapshots.
const MEM_TRACE = process.env.RWSDK_MEM_TRACE === "1";
function memSnapshot(label: string) {
  if (!MEM_TRACE) return;
  if (typeof (globalThis as any).gc === "function") {
    (globalThis as any).gc();
  }
  const mu = process.memoryUsage();
  const hs = v8.getHeapStatistics();
  const mb = (n: number) => (n / 1024 / 1024).toFixed(0);
  console.log(
    `[mem] ${label.padEnd(32)}  rss=${mb(mu.rss)}M  heapUsed=${mb(mu.heapUsed)}M  heapTotal=${mb(mu.heapTotal)}M  external=${mb(mu.external)}M  heapLimit=${mb(hs.heap_size_limit)}M`,
  );
}

type SubprocessPhase = "ssr" | "client";

type State = {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  clientEntryPoints: Set<string>;
};

function loadState(state: State) {
  if (!STATE_FILE || !existsSync(STATE_FILE)) return;
  const s = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  for (const p of s.clientFiles ?? []) state.clientFiles.add(p);
  for (const p of s.serverFiles ?? []) state.serverFiles.add(p);
  for (const p of s.clientEntryPoints ?? []) state.clientEntryPoints.add(p);
  log(
    "loaded state from %s: %d client / %d server / %d entry points",
    STATE_FILE,
    state.clientFiles.size,
    state.serverFiles.size,
    state.clientEntryPoints.size,
  );
}

function saveState(state: State, stateFile: string) {
  writeFileSync(
    stateFile,
    JSON.stringify(
      {
        clientFiles: [...state.clientFiles],
        serverFiles: [...state.serverFiles],
        clientEntryPoints: [...state.clientEntryPoints],
      },
      null,
      2,
    ),
  );
}

async function spawnPhase(
  phase: SubprocessPhase,
  stateFile: string,
): Promise<void> {
  // Resolve vite/package.json (an exported subpath) and derive the bin path
  // from the package directory. Picks the same vite the outer build is using.
  const pkgUrl = await import.meta.resolve!("vite/package.json");
  const pkgPath = new URL(pkgUrl).pathname;
  const viteBin = resolve(dirname(pkgPath), "bin", "vite.js");

  return new Promise((resolveSpawn, rejectSpawn) => {
    const child = spawn(process.execPath, [viteBin, "build"], {
      env: {
        ...process.env,
        RWSDK_STATE_FILE: stateFile,
        RWSDK_PHASE: phase,
        // Prevent the child from re-entering the orchestrator path.
        RWSDK_SUBPROCESS_BUILD: "0",
      },
      stdio: "inherit",
    });
    child.on("error", rejectSpawn);
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (code === 0) {
        resolveSpawn();
      } else {
        rejectSpawn(
          new Error(
            `rwsdk build phase "${phase}" failed: exit code ${code}${signal ? ` (signal ${signal})` : ""}`,
          ),
        );
      }
    });
  });
}

/**
 * The build orchestrator runs the multi-phase production build:
 *   1. plugin-setup pass (codegen warmup)
 *   2. directive scan
 *   3. worker pass 1 (tree-shake, populate clientFiles/serverFiles/entries)
 *   4. ssr build (subprocess child, in parallel with client)
 *   5. client build (subprocess child, in parallel with ssr)
 *   6. linker pass
 *   7. post-build (base path nesting, etc)
 *
 * Phases 1, 2, 3, 6 stay in-process because the linker pass requires the same
 * Vite worker environment object (and therefore the same plugin instances) as
 * worker pass 1. Phases 4 and 5 run as isolated subprocesses to prevent their
 * heap usage from stacking on the parent's worker-pass retained graph, which
 * is what causes OOMs on default Node heap caps for larger apps.
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
  const state: State = { clientFiles, serverFiles, clientEntryPoints };

  // Single-phase mode (used by ssr/client subprocess children). The child
  // loads its inputs from the state file, runs only the named phase, and
  // exits.
  // context(justinvdm, 22 Apr 2026): In the in-process build, buildApp sets
  // RWSDK_BUILD_PASS="worker" at the start of worker pass 1 and never
  // resets it. So during the SSR and Client passes the env var still reads
  // "worker", and several rwsdk plugins depend on that (e.g.
  // directivesFilteringPlugin, createDirectiveLookupPlugin, ssrBridgePlugin
  // all branch on `RWSDK_BUILD_PASS === "worker"` / `!== "worker"`). A
  // subprocess child starts with the env var unset, which would flip the
  // branches and produce subtly-wrong bundles. Set it explicitly to
  // mirror the in-process semantics.
  if (PHASE_ONLY === "ssr") {
    process.env.RWSDK_BUILD_PASS = "worker";
    loadState(state);
    memSnapshot("00-ssr-start");
    console.log("Building SSR...");
    await builder.build(builder.environments.ssr);
    memSnapshot("01-ssr-done");
    return;
  }
  if (PHASE_ONLY === "client") {
    process.env.RWSDK_BUILD_PASS = "worker";
    loadState(state);
    memSnapshot("00-client-start");
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
    memSnapshot("01-client-done");
    return;
  }

  // Parent / in-process mode.
  await rm(resolve(projectRootDir, "dist"), { recursive: true, force: true });
  memSnapshot("00-buildApp-start");

  const workerEnv = builder.environments.worker;

  // Phase 1: plugin-setup. Triggers buildStart hooks for plugins that
  // generate source files (e.g. content-collections), so the directive scan
  // sees them.
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
        input: { index: tempEntryPath },
      },
    };
    await builder.build(workerEnv);
    workerEnv.config.build = originalWorkerBuildConfig;
  } finally {
    await rm(tempEntryPath, { force: true });
  }
  memSnapshot("01-after-plugin-setup");

  // Phase 2: directive scan.
  await runDirectivesScan({
    rootConfig: builder.config,
    environments: builder.environments,
    clientFiles,
    serverFiles,
    entries: [workerEntryPathname],
    esbuildOptions,
  });
  memSnapshot("02-after-directive-scan");

  // Phase 3: worker pass 1.
  console.log("Building worker...");
  process.env.RWSDK_BUILD_PASS = "worker";
  await builder.build(workerEnv);
  memSnapshot("03-after-worker-pass-1");
  log(
    "Used client files after worker build & filtering: %O",
    Array.from(clientFiles),
  );

  // Phases 4 + 5: spawn SSR and Client as isolated subprocesses in parallel,
  // unless explicitly opted out. Each child loads filtered state from a file
  // and only runs its single phase.
  if (SUBPROCESS_OPT_OUT) {
    console.log(
      "[rwsdk] subprocess builds disabled (RWSDK_SUBPROCESS_BUILD=0); running ssr + client in-process",
    );
    console.log("Building SSR...");
    await builder.build(builder.environments.ssr);
    memSnapshot("04-after-ssr");
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
    memSnapshot("05-after-client");
  } else {
    const stateDir = resolve(projectRootDir, "dist", ".rwsdk");
    const stateFile = resolve(stateDir, "build-state.json");
    await mkdir(stateDir, { recursive: true });
    saveState(state, stateFile);
    console.log(
      "[rwsdk] running ssr + client as parallel subprocesses (set RWSDK_SUBPROCESS_BUILD=0 to disable)",
    );
    try {
      await Promise.all([
        spawnPhase("ssr", stateFile),
        spawnPhase("client", stateFile),
      ]);
    } finally {
      await rm(stateDir, { recursive: true, force: true });
    }
    memSnapshot("05-after-ssr+client-subprocesses");
  }

  // Phase 6: linker pass. Must reuse the *same* worker environment object as
  // worker pass 1 — see productionBuildProcess.md "A naive approach would be
  // to create a separate `linker` Vite environment…". @cloudflare/vite-plugin
  // and our lookup-map plugins depend on the cross-phase plugin instance
  // state established during worker pass 1.
  console.log("Linking worker build...");
  process.env.RWSDK_BUILD_PASS = "linker";
  const workerConfig = workerEnv.config;
  workerConfig.build!.emptyOutDir = false;
  // context(justinvdm, 22 Sep 2025): Re-point the original entry to the
  // intermediate worker bundle from the first pass; the Cloudflare plugin
  // expects an entry chunk named `index`.
  workerConfig.build!.rollupOptions!.input = {
    index: resolve(projectRootDir, "dist", "worker", "index.js"),
  };
  await builder.build(workerEnv);
  memSnapshot("06-after-linker");

  console.log("Build complete!");

  await runPostBuildSteps({ projectRootDir, builder });
}

/**
 * Post-build steps that operate on the final dist/ output. Runs in the
 * orchestrator process (not in any subprocess child).
 */
async function runPostBuildSteps({
  projectRootDir,
  builder,
}: {
  projectRootDir: string;
  builder: ViteBuilder;
}) {
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
    const wranglerCandidates = [
      "wrangler.json",
      "wrangler.jsonc",
      "wrangler.toml",
    ];
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
