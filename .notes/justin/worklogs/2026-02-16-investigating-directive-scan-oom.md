# Worklog: Directive Scan OOM Investigation & Handoff (2026-02-16)

## Context & Critical Files
A significant Out-of-Memory (OOM) issue has been reported in the RedwoodJS SDK's directive scanning process, reaching up to 7GB of heap usage. This process identifies `"use client"` and `"use server"` directives to configure the Vite build.

**Primary Logic Location:** [sdk/src/vite/runDirectivesScan.mts](sdk/src/vite/runDirectivesScan.mts)
- **Engine:** `esbuild` with a custom plugin (`esbuildScanPlugin`).
- **Resolver:** Uses `enhanced-resolve` via a bridge to identify file locations.
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

## Primary Hypotheses for Next Phase

### A. Asset Loading Bloat
The scanner might be resolving and loading non-script assets (SVGs, large JSON, or binaries). Even if esbuild doesn't use them, the `onLoad` hook in [sdk/src/vite/runDirectivesScan.mts](sdk/src/vite/runDirectivesScan.mts) currently passes through contents to `readFileWithCache`.
- **Action:** Instrument `onLoad` to log the extensions and sizes of files being put into `fileContentCache`.

### B. Esbuild Internal Buffers
Even if the plugin returns empty contents for certain files, esbuild might be internally buffering data from large imports.
- **Action:** Check if returning `{ contents: '', loader: 'js' }` for `node_modules` entries (where directives are rare) mitigates the OOM without losing scanning accuracy.

### C. Real Lucide Internals
Actual icon libraries like `lucide-react` may have specific export patterns or transformation markers that trigger unexpected memory accumulation in the `enhanced-resolve` bridge.

## Investigation Checklist for Follow-up
1.  **Instrument [sdk/src/vite/runDirectivesScan.mts](sdk/src/vite/runDirectivesScan.mts)**:
    - Add logs for `fileContentCache.size` and total bytes stored.
    - Track "Race" counts (how many times a path is read before it's cached).
2.  **Reproduction**:
    - Use actual `lucide-react` via npm, not synthetic mocks.
    - Include large `.svg` and `.png` imports to test "Asset Bloat" hypothesis.

## Summary of Handoff
We have proven *how* the memory can be exhausted (Multipliers + Caching), but haven't found the specific project structure that hits 7GB. The solution should involve **Stateless Scanning** (don't cache content), **Path Normalization** (fuse casing/symlink duplicates), and **Inflight Promise Management**.
