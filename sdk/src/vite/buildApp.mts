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

// context(justinvdm, 22 Apr 2026): Subprocess-per-phase mode.
// Vite/Rollup retains the parsed module graph (acorn AST + scope analysis +
// chunk IR + magic-string buffers) on the BuildEnvironment object after
// `builder.build()` returns. The retained heap survives explicit `global.gc()`.
// Across the 5 phases of our production build, this state stacks: each phase
// inherits the prior phases' retained graph as baseline memory. For larger
// apps that stack pushes the worker SSR / client phase's own working set past
// Node's default ~2 GB old-gen heap cap on `ubuntu-latest` and the build
// OOMs.
//
// Subprocess-per-phase isolates each phase in its own Node process. When the
// phase exits the OS reclaims its heap, so the next phase starts at ~150 MB
// baseline rather than ~900 MB. This converts the OOM ceiling from "running
// sum of all phases" to "worst single phase" — for one large consumer that
// was a 1,492 MB → 850 MB drop in peak heap (-43%), restoring ~640 MB of
// heap headroom to the busiest phase.
//
// Phases that don't depend on each other (SSR and Client both consume
// Worker Pass 1 outputs and produce no shared state) run concurrently, which
// also shaves wall time.
//
// Opt-out: set RWSDK_SUBPROCESS_BUILD=0 to fall back to the in-process build.
// State plumbing: the 3 cross-phase Sets (clientFiles, serverFiles,
// clientEntryPoints) are serialized to a JSON file in dist/ that each
// subprocess reads at start and (for phases that mutate state) writes at end.
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

// Phase grouping is constrained by the Cloudflare Vite plugin's lifecycle:
// its writeBundle hook expects to fire after a real worker build (it needs
// the worker's emitted wrangler.json on disk). If we ran plugin-setup or
// the directive scan in their own subprocess that called builder.build()
// with the temp empty entry, that hook would fire on a phase that produces
// no real output and crash with ENOENT. So plugin-setup + directive-scan +
// worker pass 1 are combined into a single "worker" subprocess that owns
// the full Cloudflare-plugin worker-build lifecycle. The other consumer
// phases (ssr, client, linker) only consume Worker Pass 1 outputs and run
// in their own subprocesses.
type Phase = "worker" | "ssr" | "client" | "linker";

type State = {
  clientFiles: Set<string>;
  serverFiles: Set<string>;
  clientEntryPoints: Set<string>;
};

function loadState(state: State) {
  if (!STATE_FILE || !existsSync(STATE_FILE)) return;
  try {
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
  } catch (e) {
    log("failed to load state file %s: %s", STATE_FILE, (e as Error).message);
  }
}

function saveState(state: State) {
  if (!STATE_FILE) return;
  writeFileSync(
    STATE_FILE,
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

async function spawnPhase(phase: Phase, stateFile: string): Promise<void> {
  // Resolve the vite binary the consumer is using; spawn it in a fresh
  // Node process with RWSDK_PHASE set so its buildApp invocation runs
  // only this phase. RWSDK_SUBPROCESS_BUILD=0 prevents the child from
  // recursing into another orchestrator.
  //
  // context(justinvdm, 22 Apr 2026): We can't `import.meta.resolve(
  // "vite/bin/vite.js")` because vite's `exports` map doesn't expose that
  // subpath. Instead resolve `vite/package.json` (which IS exported) and
  // derive the bin path from there. This still picks the same vite the
  // outer build is using.
  const pkgUrl = await import.meta.resolve!("vite/package.json");
  const pkgPath = new URL(pkgUrl).pathname;
  const viteBin = resolve(dirname(pkgPath), "bin", "vite.js");

  return new Promise((resolveSpawn, rejectSpawn) => {
    const child = spawn(process.execPath, [viteBin, "build"], {
      env: {
        ...process.env,
        RWSDK_STATE_FILE: stateFile,
        RWSDK_PHASE: phase,
        RWSDK_SUBPROCESS_BUILD: "0",
      },
      stdio: "inherit",
    });
    child.on("error", rejectSpawn);
    child.on("exit", (code, signal) => {
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
 * The build orchestrator is responsible for running the multi-phase build
 * process for production. It is designed to solve the circular dependency
 * between the worker, client, and SSR builds.
 *
 * Three modes:
 *   1. Subprocess orchestrator (default for top-level invocation): spawns
 *      each phase as a fresh Node subprocess and persists cross-phase state
 *      to a JSON file under dist/. Solves the multi-pass heap accumulation
 *      that pushed large apps over Node's default ~2 GB heap cap on CI.
 *   2. Single-phase mode (used by the subprocess children): activated when
 *      RWSDK_PHASE is set; runs only that phase and exits.
 *   3. In-process all-phases (legacy): activated when the orchestrator is
 *      explicitly opted out via RWSDK_SUBPROCESS_BUILD=0. Equivalent to
 *      pre-subprocess behavior.
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

  // Mode 1: subprocess orchestrator
  if (!PHASE_ONLY && !SUBPROCESS_OPT_OUT) {
    await runSubprocessOrchestrator({ projectRootDir, builder });
    return;
  }

  // Modes 2 + 3 share the same per-phase code path; PHASE_ONLY gates which
  // phases actually execute. In Mode 2 (PHASE_ONLY set) the phase loads
  // state from STATE_FILE and writes back if it produced new state. In
  // Mode 3 (no PHASE_ONLY, SUBPROCESS_OPT_OUT) every phase runs sequentially
  // in this process.

  // The orchestrator (Mode 1) cleans dist itself before writing the state
  // file; in-process all-phases (Mode 3) cleans dist here. Single-phase
  // children (Mode 2) MUST NOT clean dist — they would wipe the state file
  // and any intermediate artifacts written by prior phases.
  if (!PHASE_ONLY) {
    await rm(resolve(projectRootDir, "dist"), { recursive: true, force: true });
  }

  loadState(state);
  memSnapshot("00-buildApp-start");

  const workerEnv = builder.environments.worker;

  if (!PHASE_ONLY || PHASE_ONLY === "worker") {
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

    memSnapshot("01-after-plugin-setup");

    await runDirectivesScan({
      rootConfig: builder.config,
      environments: builder.environments,
      clientFiles,
      serverFiles,
      entries: [workerEntryPathname],
      esbuildOptions,
    });

    memSnapshot("02-after-directive-scan");

    console.log("Building worker...");
    process.env.RWSDK_BUILD_PASS = "worker";
    await builder.build(workerEnv);

    memSnapshot("03-after-worker-pass-1");

    log(
      "Used client files after worker build & filtering: %O",
      Array.from(clientFiles),
    );

    if (PHASE_ONLY === "worker") {
      // Worker phase mutates state (filters clientFiles, adds clientEntryPoints).
      saveState(state);
      return;
    }
  }

  if (!PHASE_ONLY || PHASE_ONLY === "ssr") {
    // context(justinvdm, 22 Apr 2026): In in-process mode, RWSDK_BUILD_PASS
    // lingers as "worker" from the previous phase when SSR runs (no reset
    // between phases). Several rwsdk plugins depend on this lingering value
    // to apply worker-equivalent behavior during SSR build (e.g.
    // ssrBridgePlugin, directivesFilteringPlugin, createDirectiveLookupPlugin
    // all check RWSDK_BUILD_PASS === "worker" or !== "worker"). When SSR
    // runs in its own subprocess that env var starts unset, breaking those
    // plugins' module resolution (we saw "ssrWebpackRequire is not exported
    // by no-react-server.js"). Set it explicitly to mirror the in-process
    // behavior.
    process.env.RWSDK_BUILD_PASS = "worker";

    console.log("Building SSR...");
    await builder.build(builder.environments.ssr);

    memSnapshot("04-after-ssr");

    if (PHASE_ONLY === "ssr") {
      // SSR is a state consumer; no writeback needed.
      return;
    }
  }

  if (!PHASE_ONLY || PHASE_ONLY === "client") {
    // Same RWSDK_BUILD_PASS lingering reason as the SSR phase above.
    process.env.RWSDK_BUILD_PASS = "worker";

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

    if (PHASE_ONLY === "client") {
      // Client is a state consumer; no writeback needed.
      return;
    }
  }

  if (!PHASE_ONLY || PHASE_ONLY === "linker") {
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

    memSnapshot("06-after-linker");

    if (PHASE_ONLY === "linker") {
      // Linker is a state consumer; no writeback needed.
      return;
    }
  }

  console.log("Build complete!");

  await runPostBuildSteps({ projectRootDir, builder });
}

/**
 * Mode 1 — orchestrate the 5 phases as separate Node subprocesses with state
 * persisted to a JSON file. Phases 3 (SSR) and 4 (Client) run concurrently
 * because neither depends on the other; they only consume Worker Pass 1
 * outputs and don't produce shared state.
 */
async function runSubprocessOrchestrator({
  projectRootDir,
  builder,
}: {
  projectRootDir: string;
  builder: ViteBuilder;
}) {
  await rm(resolve(projectRootDir, "dist"), { recursive: true, force: true });

  const stateDir = resolve(projectRootDir, "dist", ".rwsdk");
  const stateFile = resolve(stateDir, "build-state.json");
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, "{}");

  console.log("[rwsdk] running subprocess-per-phase build (set RWSDK_SUBPROCESS_BUILD=0 to disable)");

  // First subprocess: plugin-setup + directive-scan + worker pass 1
  // (combined; see the Phase type comment for why these can't be split).
  await spawnPhase("worker", stateFile);

  // SSR and Client are independent — neither writes shared state, both only
  // consume Worker Pass 1 outputs. Run them concurrently.
  await Promise.all([
    spawnPhase("ssr", stateFile),
    spawnPhase("client", stateFile),
  ]);

  // Linker depends on both intermediate worker.js (from worker pass 1) and
  // ssr_bridge.js (from ssr).
  await spawnPhase("linker", stateFile);

  // Clean up state file but leave dist/ intact.
  await rm(stateDir, { recursive: true, force: true });

  // context(justinvdm, 22 Apr 2026): Vite v7's default buildApp hook
  // checks whether any environment was built in-process and falls back to
  // building all environments if none were:
  //   if (Object.values(builder.environments).every((e) => !e.isBuilt)) {
  //     for (const e of …) await builder.build(e);
  //   }
  // Since we spawned subprocesses for every phase, no `builder.build()`
  // call happened in this process and `env.isBuilt` is false on all
  // environments — which would trigger that fallback to build everything
  // again (and fail, because the bundles already exist on disk and the
  // worker env can't resolve `rwsdk/__ssr_bridge` without the linker
  // having run inline).
  // Mark every environment as built so vite's fallback is skipped.
  for (const environment of Object.values(builder.environments)) {
    (environment as any).isBuilt = true;
  }

  console.log("Build complete!");

  await runPostBuildSteps({ projectRootDir, builder });
}

/**
 * Post-build steps that need to run in the orchestrator process (not in any
 * single-phase subprocess), since they operate on the final dist/ output
 * after all phases have completed.
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
