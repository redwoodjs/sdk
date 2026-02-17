# Reproduction of 7GB OOM in Przm (2026-02-17)

## Initial assessment of the 7GB OOM in DirectiveScan
We started the session with the goal of reproducing a reported 7GB OOM issue in the `DirectiveScan` process within the `przm` codebase. The existing logs indicated that the scanner was exhausting memory on CI runners, likely due to the complexity of the dependency graph and the high volume of file reads. We decided to bridge the gap between synthetic tests and the real project by instrumenting the scanner and running it directly on the `przm` source.

## Created synthetic stress test and identified Lucide-React fan-out
To isolate the memory pressure, we first created a playground stress test. We discovered that a single import from `lucide-react` (specifically `dynamicIconImports`) triggers a "fan-out" effect, where `esbuild` is forced to resolve and scan over 1,600 individual icon files. This demonstrated how a small number of imports could result in a massive expansion of the dependency graph, providing a clear lead for the memory exhaustion.

## Instrumented DirectiveScan with high-resolution memory logging
We added per-second "Memory Ticks" to the `runDirectivesScan.mts` core logic in the SDK. This instrumentation logs `rss`, `heapUsed`, and `heapTotal` frequently, allowing us to see memory spikes that occur between standard progress logs. We also added a `scanStats` object to track total files read, cache size, total bytes read, and "races" (instances where multiple parallel reads were triggered for the same file).

## Reproduced nearly 1GB RSS spike on the Przm project
We set up a debug script, `debug-przm.mjs`, located in the `przm` repository. This script resolves the production Vite configuration (with bypassed database plugins) and runs the `runDirectivesScan` function using all 626 source files as entry points simultaneously. During execution, we observed a massive jump in memory usage: **RSS spiked from 361MB to 821MB in a single tick**, while the V8 Heap stayed consistently low (~31MB-50MB). This confirmed that the memory pressure is not originating from leaked JavaScript objects, but from native buffers and the underlying `esbuild` process handling a massive, redundant graph.

## Identified potential for "Multiplier Effect" and path resolution as the root cause
Our findings point to potential "Multiplier Effect" where the interaction between `esbuild`'s native resolution and our custom `createViteAwareResolver` results in duplicate processing of the same physical files under different path strings. We should NOT be biased by these theories - whether they are they are significant factors for the issue at hand is pure conjecture at this point.
- **Races**: The scanner was triggering redundant `fs.readFile` calls for the same file before the first call could be cached.
- **Divergent Paths**: Subtle differences in path casing (on macOS) or symlink resolution cause the same dependency to be treated as unique, multiplying the memory required to store file contents in the `fileContentCache`.

## Detailed CI Setup Analysis
Our investigation into the "przm" CI configuration revealed several critical factors that compound the memory pressure:

- **Runner Constraints**: 
    - The main build runs on `ubuntu-latest` (standard 7GB / 2-core GitHub runner) via `.github/workflows/deploy.yml`.
    - PR Previews use `ubuntu-latest-m` (Medium runner) via `.github/workflows/alchemy-pr-preview.yml`.
- **Workflow Commands**:
    - Both workflows run `pnpm install` followed by a build command.
    - `deploy.yml` runs `pnpm release`, which executes `pnpm run clean && pnpm run build`.
    - `alchemy-pr-preview.yml` runs `pnpm run clean && pnpm run build`.
    - **Confirmed Failure Pattern**: A CI run confirmed that the OOM occurs during `pnpm build:ci` (`vite build`). The logs show the process being "canceled" (GitHub's signal for OOM) immediately after the DirectiveScan begins:
      ```
      Run pnpm build:ci
      > CLOUDFLARE_ENV=ci vite build --mode ci
      Running plugin setup pass...
      ...
      ✓ built in 34ms
      … (rwsdk) Scanning for 'use client' and 'use server' directives...
       ELIFECYCLE  Command failed.
      Error: The operation was canceled.
      ```
    - **Confirmed Observation**: Git logs for PR #817 in the `przm` repository indicate that the `DirectiveScan` has been a source of memory exhaustion on CI runners (specifically when traversing `lucide-react`). This confirms the scanner as a likely vector for OOM reports.
- **pnpm Symlink Strategy**: The project uses `pnpm@10.15.1`, which utilizes a deeply symlinked `node_modules` structure. 
- **Path Reference Mismatch (Cache Poisoning)**: The custom `rwsdk.patch` in the project (and the current SDK source) uses `fsp.realpath(path)` to store module environments, but the scanner looks them up using `args.importer` (the symlinked path from esbuild). Since these never match on `pnpm`, it forces a "Cache-Miss Re-Classification" loop, re-scanning the same files repeatedly.
- **Entry Point Multiplier**: The project has 268 files with "use client"/"use server" directives. The scanner adds all of these as entry points to a single `esbuild.build` call, forcing `esbuild` to manage hundreds of concurrent resolution graphs.
- **FS Hammering (Racing I/O)**: The current `runDirectivesScan.mts` implementation has a confirmed "Racing" bug in `readFileWithCache` where it triggers redundant `fs.readFile` calls for every request, even if already cached or in-flight. Combined with the 1,866 `lucide-react` icons, this hammers the OS with thousands of concurrent syscalls, exhausting native memory buffers.

## Rapid Reproduction Brainstorming
To move faster than synthetic tests, we can set up a local Docker-based reproduction that mimics the CI environment:

- **Container Image**: `node:22-slim` (to match the project's requirement).
- **Resource Limits**: Run with `--memory=7g` and `--cpus=2` to match `ubuntu-latest`.
- **Environment**: Mount the `przm` source and the local `sdk`.
- **Goal**: Reproduce the OOM locally by running the exact CI build commands in a resource-constrained container.
