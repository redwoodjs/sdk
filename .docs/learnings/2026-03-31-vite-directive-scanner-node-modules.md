# Vite directive scanner crashes on third-party packages with 'use client'

## Problem

When lucide-react v1.7.0 is installed in an rwsdk project, running `bun dev` or `vite dev` crashes with:

```
(ssr) No module found for '/node_modules/lucide-react/dist/esm/Icon.js' in module lookup for "use client" directive
```

The Vite plugin's directive scanner crashes because it processes files inside `node_modules` rather than skipping them.

## Root Causes

### Primary: Scanner lacks node_modules guard

**Location**: `sdk/src/vite/runDirectivesScan.mts`, `build.onLoad` handler, lines 354–426

The esbuild scan plugin's `build.onLoad` handler processes every module esbuild traverses, including those in `node_modules`. There is no filter for `node_modules` paths.

When a user file imports `lucide-react`, esbuild traverses into `node_modules/lucide-react/dist/esm/icons/Icon.js`. lucide-react v1.7.0 marks this file with `'use client'`. The `hasDirective()` check returns `true`, and the scanner adds the absolute path to `clientFiles`:

```typescript
// runDirectivesScan.mts line 388-389
clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
```

At runtime, the lookup map (`createDirectiveLookupPlugin.generateLookupMap`) routes all `node_modules` paths through the vendor barrel export (`rwsdk/__vendor_client_barrel`). This barrel is populated only with entries from the application's own files — it does not contain lucide-react's internal icon paths. The SSR environment then fails to find the module.

### Secondary: normalizeModulePath heuristic is fragile

**Location**: `sdk/src/lib/normalizeModulePath.mts`, lines 67–90

The `normalizeModulePath` function uses `commonDepth > 0` as a heuristic to distinguish project-internal from external absolute paths. For `node_modules` paths where the project root is at or near the repository root (e.g., `/home/vscode/repo/`), `commonDepth` can be ≥ 2 (segments `/` and `/home/vscode/repo` match, diverges at `node_modules` vs `src/`). This causes the path to be passed through unchanged, masking the issue at the normalization level while the scanner still processes the file.

The intended guard `modulePath.startsWith(projectRootDir + "/")` correctly rejects `node_modules` paths in most cases, but the `else` branch fallback is unreliable.

### Tertiary: Path format mismatch between scanner and transform

**Locations**:
- `sdk/src/vite/runDirectivesScan.mts` line 389: scanner stores absolute paths
- `sdk/src/vite/directivesPlugin.mts` lines 80, 152: transform uses project-relative paths for `clientFiles.has()` lookups

The `createDirectiveLookupPlugin.test.mts` explicitly documents that `clientFiles`/`serverFiles` are expected to contain relative `node_modules` paths (e.g., `"node_modules/lib-a/index.js"`). The scanner adds absolute paths (e.g., `/home/vscode/repo/node_modules/...`). These formats never match for `node_modules` entries, which would cause incorrect transform behavior independently of the scanning issue.

## Solution

**Option A (Recommended)**: Add a `node_modules` guard to the scanner's `build.onLoad` handler in `runDirectivesScan.mts`. Skip files containing `/node_modules/` rather than processing them. This is the most targeted fix.

```typescript
// In build.onLoad, before processing:
if (args.path.includes("/node_modules/")) {
  log("Skipping node_modules file:", args.path);
  return null;
}
```

**Option B**: Fix the `normalizeModulePath` heuristic to explicitly check for paths outside the project root that contain `/node_modules/`. This addresses the underlying fragility and benefits all callers of this function.

**Option C**: Standardize path format across the scanner and all `clientFiles.has()` call sites. This is the highest-effort option and is only necessary if third-party `'use client'` directives need to be tracked (which the current design does not support).

## Key Lesson

The directive scanner's purpose is to find directives in **application source code** — not in third-party packages. The vendor barrel export mechanism (`rwsdk/__vendor_client_barrel`) handles external packages. Any import traversal that reaches `node_modules` should be externalized, not scanned. A single-line `node_modules` guard in the `build.onLoad` handler would have prevented this entire class of crash.
