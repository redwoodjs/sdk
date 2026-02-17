# Worklog: Directive Scan OOM Investigation & Handoff (2026-02-16)

## Context & Critical Files
A significant Out-of-Memory (OOM) issue has been reported in the RedwoodJS SDK's directive scanning process, reaching up to 7GB of heap usage on CI runners. This process identifies `"use client"` and `"use server"` directives to configure the Vite build.

**Primary Logic Location:** [sdk/src/vite/runDirectivesScan.mts](sdk/src/vite/runDirectivesScan.mts)
- **Engine:** `esbuild` with a custom plugin (`esbuildScanPlugin`).
- **Resolver:** Uses `enhanced-resolve` via a bridge in [sdk/src/vite/createViteAwareResolver.mts](sdk/src/vite/createViteAwareResolver.mts) to identify file locations.
- **Cache:** `fileContentCache` (a `Map<string, string>`) stores full source code for every file resolved and loaded.

## Captured Evidence (Trials 1-12)

### 1. The Scaling "Gap"
- **Finding (Trial 11):** A synthetic project with 2,000 "icon" files (simulating `lucide-react`) used only ~350MB RSS. 
- **The Gap:** There is a massive discrepancy between synthetic 350MB usage and real-world 7GB reports. This suggests the OOM is not caused by raw file count alone, but by "Multiplier Effects" or high-volume asset loading.

### 2. Path Multipliers (Casing)
- **Finding (Trial 10):** On macOS, the scanner is case-sensitive but the filesystem is not. 
- **Repro:** Resolving `Target.ts` and `target.ts` results in two distinct absolute paths in esbuild, causing the same physical file to be read and stored twice in `fileContentCache`.

### 3. Inflight Duplication (Races)
- **Finding (Trial 12):** Many files (especially barrel files) are imported by hundreds of modules simultaneously.
- **Problem:** Because `onResolve` and `onLoad` are parallelized, multiple concurrent `readFile` operations occur for the same path before the first result is committed to the cache. This creates a memory spike from redundant buffers.

### 4. Content Cache Bloat
- **Finding (Trial 8):** 500 files of 10MB each definitively crash the process. The `Map<string, string>` holding the full content of every source file is the primary heap sink.

### 5. Lucide-React Barrel Exports
- **Finding:** A specific project structure hitting OOM was found to include `lucide-react`. The `lucide-react/dist/esm/lucide-react.js` barrel re-exports from 1,866 individual icon files. Each icon imports `createLucideIcon.js` -> `Icon.js` -> `react`.
- **The Impact:** The scanner reads, resolves, and caches all 1,800+ modules recursively.

## Ruled Out Approaches

### Short-circuiting `node_modules` via empty contents
- **Proposed Fix:** In `onLoad`, after classifying a `node_modules` file's directive, return `{ contents: "", loader: "js" }` to stop esbuild from following imports.
- **Verdict:** **RULED OUT**. This approach is unsafe because directives can be nested deep (e.g., a Client Directive module importing another module that contains a Server Directive). Clearing contents prevents the scanner from discovering these deep links, leading to an incomplete directive map.

## Primary Hypotheses for Next Phase

### A. Asset Loading Bloat
The scanner might be resolving and loading non-script assets (SVGs, large JSON, or binaries). Even if esbuild doesn't use them, the `onLoad` hook in [sdk/src/vite/runDirectivesScan.mts](sdk/src/vite/runDirectivesScan.mts) currently passes through contents to `readFileWithCache`.
- **Action:** Instrument `onLoad` to log the extensions and sizes of files being put into `fileContentCache`.

### B. Esbuild Internal Buffers
Even if the plugin returns empty contents for certain files, esbuild might be internally buffering data from large imports.
- **Action:** Check if returning `{ contents: '', loader: 'js' }` for `node_modules` entries (where directives are rare) mitigates the OOM without losing scanning accuracy.

### C. Real Lucide Internals
The `lucide-react/dist/esm/lucide-react.js` barrel re-exports from 1,866 individual icon files. Each icon imports `createLucideIcon.js` -> `Icon.js` -> `react`. The scanner reads, resolves, and caches all of them recursively.

## Investigation Checklist for Follow-up
1.  **Instrument [sdk/src/vite/runDirectivesScan.mts](sdk/src/vite/runDirectivesScan.mts)**:
    - Add logs for `fileContentCache.size` and total bytes stored.
    - Track "Race" counts (how many times a path is read before it's cached).
2.  **Reproduction**:
    - Use actual `lucide-react` via npm (e.g. in `community/playground/lucide-showcase`).
    - Include large `.svg` and `.png` imports to test "Asset Bloat" hypothesis.

## Adding Sidecar Memory Monitoring

To debug the OOM, we need visibility into the process memory usage *during* the crash, as post-mortem analysis is difficult when the container is killed.

We are modifying the `reproduce-oom.sh` script to:
1.  Launch a background loop inside the Docker container.
2.  Poll `free -m` and `ps` (sorted by RSS) every 0.5s.
3.  Log this to `/app/memory-profile.log` (mounted to host).
4.  Run the actual `pnpm run build:ci` payload.

## Summary of Handoff
We have proven *how* the memory can be exhausted (Multipliers + Caching), but haven't found the specific project structure that hits 7GB. The solution should involve **Stateless Scanning** (don't cache content), **Path Normalization** (fuse casing/symlink duplicates), and **Inflight Promise Management**.

---

## 2026-02-17: High-Fidelity Reproduction & Correlation

### 1. Reproduction Success
Using a Docker container (`node:22-slim`) with resource limits (7GB RAM, 2 CPUs) matching the reporting environment, we successfully reproduced the memory spike using the local PRZM project and the linked SDK.

### 2. Time-Series Analysis & Correlation
We correlated the `reproduction.log` (build phases) with a high-resolution `memory-profile.log` (RSS tracking).

| Timestamp (Z) | Build Phase | Global Used | esbuild RSS | Vite RSS | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **19:48:04** | **Scan Begins** | 1.5 GB | 13 MB | 463 MB | Start of `DirectiveScan` |
| **19:48:08** | **Reading Done** | 1.8 GB | 262 MB | 557 MB | Scanner finishes reading ~4,600 files |
| **19:48:10** | **Graph Spike** | 2.8 GB | **1.1 GB** | 620 MB | esbuild starts graph processing |
| **19:48:24** | **OOM Zone** | 7.3 GB | **5.8 GB** | 617 MB | **Exceeds 7GB runner threshold** |
| **19:48:42** | **Peak Memory** | **8.6 GB** | **6.9 GB** | 351 MB | Maximum pressure reached |
| **19:48:43** | **Worker Overlap** | 7.1 GB | 4.6 GB | **1.2 GB** | Worker build starts during esbuild flush |

### 3. Key Findings
- **esbuild vs. Vite:** The memory explosion happens inside the `esbuild` service process, not the main Vite process. While the scanner logs report ~600MB RSS for the main process, `esbuild` peaks at **~6.9GB**.
- **Post-Reading Growth:** Memory usage peaks *between* "Reading files" and "(rwsdk) Done scanning". This confirms the bottleneck is esbuild's internal handling of the resolution graph/imports for those 4,600+ modules.
- **Stacked Parallelism:** The `Building worker...` phase begins while the scanner (esbuild) still holds ~4.6GB RSS. This "stacking" of Vite builds creates a lethal memory floor that triggers OOM.
- **Racing I/O:** Instrumental logs showed 0 races in this specific run, suggesting that while "racing" is a valid bug, the sheer volume of 4,600 resolved files is enough to hit 7GB alone.

### 4. Directives Found
The scan identified 4,688 files, leading to a final graph of:
- Total Files Read: 4,688
- Extensions: `.tsx`: 395, `.ts`: 231, `.js`: 3921, `.mjs`: 141
- Total Cache Size: 17MB (in-memory buffers)

### 5. Next Steps
- Implement **Stateless Scanning**: Return empty strings or minimal contents for non-directive-containing external modules to prevent esbuild from buffering their resolution data.
- **Inflight Deduplication**: Ensure concurrent requests for the same path share a single `readFile` promise.
- **Sequential Safety**: Potentially block the Worker build from starting until the DirectiveScan process has fully exited or flushed its buffers.

