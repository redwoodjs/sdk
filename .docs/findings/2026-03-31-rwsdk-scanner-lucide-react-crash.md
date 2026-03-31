# Findings: rwsdk Directive Scanner Crash with lucide-react v1.7.0

**Date**: 2026-03-31
**Status**: Investigation complete, fix strategy identified
**Severity**: Crash in dev mode for pnpm projects using lucide-react ≥ v1.7.0

---

## Summary

When lucide-react v1.7.0 added a `'use client'` directive to its shared `Icon.js` base component, it triggered a latent path key mismatch in rwsdk's directive scanner. In pnpm projects, pnpm creates symlinks in `node_modules/` that point into a content-addressable store under `node_modules/.pnpm/`. rwsdk's scanner resolves symlinks (via `fsp.realpath()`) before recording a client file's path, but a separate code path that generates the worker stub does **not** resolve symlinks — it uses the raw symlinked path. This produces two different string keys for the same file. At runtime, the worker stub calls the SSR module loader with the symlinked key, but the lookup map only contains the real (`.pnpm` store) key, causing a miss and the error: `No module found for /node_modules/lucide-react/dist/esm/Icon.js in module lookup for "use client" directive`. The correct fix is to apply symlink resolution in the stub-generation code path, making it symmetric with the scanner — a one-line change that makes all three links in the runtime lookup chain (worker stub key, lookup map key, vendor barrel key) agree on the same canonical path.

---

## Methodology

1. **Error message search**: Located the exact throw sites by searching for `No module found for` in the rwsdk source. Found in two files corresponding to client and SSR runtime environments.

2. **Scanner source read**: Read `runDirectivesScan.mts`, `directivesPlugin.mts`, `transformClientComponents.mts`, `createDirectiveLookupPlugin.mts`, and `directiveModulesDevPlugin.mts` in full. Traced the complete data flow from scan → `clientFiles` population → lookup map generation → vendor barrel generation → runtime lookup.

3. **Path normalization tracing**: Read `normalizeModulePath.mts` and `createViteAwareResolver.mts` to understand how module paths are normalized and how the enhanced-resolve symlink option interacts with Vite's `preserveSymlinks` setting.

4. **lucide-react package inspection**: Obtained `lucide-react@1.7.0` via `npm pack` and extracted the tarball to confirm the presence and position of the `'use client'` directive in `dist/esm/Icon.js` and to trace the import chain from the package entry point to `Icon.js`.

5. **Source citation anchoring**: All claims tied to specific file path and line number in the live repository, with no reliance on ephemeral scripts.

---

## Findings

### Q1 — Where does the scanner resolve modules for `'use client'`/`'use server'` directives?

**Primary location**: `sdk/src/vite/runDirectivesScan.mts`, lines 382–393.

The scanner runs as an esbuild plugin invoked by the `configEnvironment` hook (worker environment). esbuild's module resolver, configured via `createViteAwareResolver` (`sdk/src/vite/createViteAwareResolver.mts`, line 349), passes `symlinks: envResolveOptions.preserveSymlinks` to enhanced-resolve. Since Vite's default `preserveSymlinks` is `false`, and enhanced-resolve's `symlinks: false` means "do not follow symlinks" (the polarity is inverted relative to Vite), the resolver preserves symlinks. This means `args.path` in esbuild's `onLoad` callback is the **symlinked path**.

The scanner then explicitly calls `fsp.realpath()` to resolve symlinks before storing to `clientFiles`:

```ts
// runDirectivesScan.mts lines 382–393
const realPath = await fsp.realpath(args.path);
moduleEnvironments.set(realPath, moduleEnv);
if (isClient) {
  clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
}
```

For pnpm, this transforms, e.g.:
- Input (`args.path`): `/…/node_modules/lucide-react/dist/esm/Icon.js` (symlink)
- After `realpath`: `/…/node_modules/.pnpm/lucide-react@1.7.0/node_modules/lucide-react/dist/esm/Icon.js`
- After `normalizeModulePath` (Vite-style relative): `/node_modules/.pnpm/lucide-react@1.7.0/node_modules/lucide-react/dist/esm/Icon.js`

**Scan scope**: The scan is triggered for all project entry points (worker entry files) plus any files in `src/` that contain a directive (`findDirectiveRoots`). esbuild follows all transitive imports — including into `node_modules` — so `Icon.js` is discovered when any project file imports a lucide-react icon. There is **no exclusion** of `node_modules` paths from the scan.

**Data structures**:
- `clientFiles: Set<string>` — Vite-style root-relative paths (e.g., `/node_modules/.pnpm/…`) using realpath-resolved keys.
- `serverFiles: Set<string>` — same structure for `'use server'` files.
- `moduleEnvironments: Map<string, string>` — realpath → environment name.

---

### Q2 — Why does it fail on `/node_modules/lucide-react/dist/esm/Icon.js`?

**Full causal chain:**

#### Step 1: lucide-react v1.7.0 adds `'use client'` to `Icon.js`

`lucide-react@1.7.0` `dist/esm/Icon.js` contains:
```js
"use strict";
"use client";
// @license lucide-react v1.7.0 - ISC
import { forwardRef, createElement } from 'react';
```

`Icon.js` is the shared base component used by every icon in the library. The import chain is:
```
lucide-react (index.js)
  → ChevronRight.js (any individual icon)
    → createLucideIcon.js
      → Icon.js  ← "use client" here
```

Any project import of any lucide-react icon transitively reaches `Icon.js`.

#### Step 2: Scan stores the pnpm real path in `clientFiles`

The scanner encounters `Icon.js` during esbuild's transitive walk. It calls `fsp.realpath(args.path)` (line 382) and stores the resolved path. For pnpm:
```
clientFiles entry: "/node_modules/.pnpm/lucide-react@1.7.0/node_modules/lucide-react/dist/esm/Icon.js"
```

#### Step 3: The node_modules guard in `directivesPlugin.mts`

`directivesPlugin.mts` line 151 has an explicit guard:
```ts
if (!args.path.includes("node_modules")) {
  // App code: check clientFiles.has(normalizedPath) ...
  // (lines 152–196)
}
// Falls through here for ALL node_modules files — clientFiles check never runs
```

For `Icon.js`, the guard is `false`. Execution skips `clientFiles.has()` entirely and falls through to lines 199–221 where the file is read and passed to `transformClientComponents`.

#### Step 4: Worker stub is generated via `hasDirective`, not `clientFiles`

Inside `transformClientComponents.mts` (lines 25–30):
```ts
if (
  !ctx.clientFiles?.has(normalizedId) &&
  !hasDirective(code, "use client")
) {
  return;
}
```

For `Icon.js`: `ctx.clientFiles?.has(normalizedId)` is `false` (symlinked key ≠ pnpm real key), but `hasDirective(code, "use client")` is `true`. The stub is generated because the file **literally contains** the directive — not via a `clientFiles` lookup.

#### Step 5: The stub embeds the symlinked path as its lookup key

The `normalizedPath` passed to `transformClientComponents` was computed at `directivesPlugin.mts` lines 141–144:
```ts
const normalizedPath = normalizeModulePath(args.path, projectRootDir);
//                                          ^^^^^^^^
//                                  args.path = symlinked path, no realpath() call
```

This `normalizedPath` becomes `normalizedId` inside the function and is embedded in the worker stub at line 133:
```ts
s.append(`const SSRModule = await ssrLoadModule("${normalizedId}");\n`);
// Produces: ssrLoadModule("/node_modules/lucide-react/dist/esm/Icon.js")
```

#### Step 6: The lookup map and vendor barrel use pnpm real paths

`generateLookupMap` (`createDirectiveLookupPlugin.mts` lines 21–48) builds the map from raw `clientFiles` entries. In dev mode, node_modules entries are mapped as:
```js
"/node_modules/.pnpm/lucide-react@1.7.0/.../Icon.js": () =>
  import("rwsdk/__vendor_client_barrel").then(m => m.default["/node_modules/.pnpm/lucide-react@1.7.0/.../Icon.js"])
```

The vendor barrel (`generateVendorBarrelContent`, `directiveModulesDevPlugin.mts` lines 14–38) also iterates `clientFiles` entries directly:
```ts
[...files].filter(f => f.includes("node_modules"))
  .map((file, i) => `  '${normalizeModulePath(file, projectRootDir)}': M${i},`)
```

Both the lookup map key and the vendor barrel export key are the pnpm real path (Vite-style).

#### Step 7: Runtime lookup fails

The worker stub executes at module load time:
```ts
const SSRModule = await ssrLoadModule("/node_modules/lucide-react/dist/esm/Icon.js");
```

The SSR runtime (`sdk/src/runtime/imports/ssr.ts` line 11) looks up this key in `useClientLookup`. The map contains only the pnpm real path key. **Miss.** The error is thrown:
```
(ssr) No module found for '/node_modules/lucide-react/dist/esm/Icon.js' in module lookup for "use client" directive
```

#### Why this was latent until v1.7.0

Earlier lucide-react versions had no `'use client'` in `Icon.js`. The `hasDirective(code, "use client")` check returned `false`, `transformClientComponents` returned early, no stub was generated, and the key mismatch was never triggered.

#### Dev-only caveat

This crash path is in the esbuild dep-optimization transform, which runs in dev mode (`vite dev`). In production Rollup builds, Vite resolves symlinks internally and provides the real path as the module `id` to the Rollup `transform` hook — matching the scan's `clientFiles` keys. The bug may be **dev-mode only**. This was not confirmed with a production build test.

---

### Q3 — What is the correct fix strategy?

#### Option A (Recommended): Apply `realpath()` in the stub-generation path

In `directivesPlugin.mts`, resolve symlinks before computing `normalizedPath`:

```ts
// Before (line 141–144):
const normalizedPath = normalizeModulePath(args.path, projectRootDir);

// After:
const realPath = await fsp.realpath(args.path);
const normalizedPath = normalizeModulePath(realPath, projectRootDir);
```

This is a single-location change, symmetric with what `runDirectivesScan.mts` already does (line 382).

**End-to-end consistency trace:**

After the fix, for a pnpm project:

| Link | Value |
|------|-------|
| Worker stub `ssrLoadModule(…)` argument | `/node_modules/.pnpm/lucide-react@1.7.0/.../Icon.js` |
| `useClientLookup` map key (from `clientFiles`) | `/node_modules/.pnpm/lucide-react@1.7.0/.../Icon.js` |
| Vendor barrel `default` export key | `/node_modules/.pnpm/lucide-react@1.7.0/.../Icon.js` |

All three links agree on the same canonical key. The lookup succeeds, the vendor barrel dispatches to the correct module binding (`M0`), and the SSR module loads.

**Risk**: Low. The `realpath` call is already proven correct (the scanner uses it). The cost is one additional async call per node_modules file during esbuild's `onLoad` processing — acceptable.

#### Option B (Not recommended): Store symlinked paths in `clientFiles`

Remove the `fsp.realpath()` call from `runDirectivesScan.mts` so `clientFiles` stores symlinked paths instead of real paths.

**Risk**: `directivesFilteringPlugin.mts` calls `this.getModuleInfo(absoluteId)` where `absoluteId` is reconstructed from a `clientFiles` entry. Vite and Rollup use real (symlink-resolved) paths as module IDs internally. Providing a symlinked path to `getModuleInfo` would cause a lookup miss, and entries would be incorrectly pruned from `clientFiles` in the production worker build pass. This risk is assessed from reading the code; it is not confirmed by a failing test, but the logic is sound.

Additionally, Option B would require auditing all other consumers of `clientFiles` (vendor barrel generation, app barrel generation, lookup map generation) for the same assumption.

#### Option C (Not applicable): Exclude node_modules from scanning

The scanner **intentionally** covers node_modules. `directiveModulesDevPlugin.mts` contains dedicated infrastructure for handling node_modules client files (vendor barrel generation), and `createDirectiveLookupPlugin.mts` has explicit node_modules branching in the lookup map generator. Excluding node_modules would break the intended design and prevent rwsdk from correctly handling any third-party package that uses `'use client'`.

---

## Evidence Index

### Tier 1 — Primary source code

| File | Lines | What it shows |
|------|-------|---------------|
| `sdk/src/vite/runDirectivesScan.mts` | 382–393 | `fsp.realpath()` call before `clientFiles.add()` — scan stores real path |
| `sdk/src/vite/directivesPlugin.mts` | 141–144 | `normalizedPath` computed from `args.path` without `realpath()` |
| `sdk/src/vite/directivesPlugin.mts` | 151 | `if (!args.path.includes("node_modules"))` guard that bypasses `clientFiles` check |
| `sdk/src/vite/directivesPlugin.mts` | 199–221 | Fallthrough to `transformClientComponents` for node_modules files |
| `sdk/src/vite/transformClientComponents.mts` | 25–30 | Entry condition: `clientFiles.has(normalizedId) || hasDirective(code, "use client")` |
| `sdk/src/vite/transformClientComponents.mts` | 133 | `ssrLoadModule("${normalizedId}")` — embeds path as lookup key in worker stub |
| `sdk/src/vite/createDirectiveLookupPlugin.mts` | 21–48 | Lookup map generation; dev node_modules entries use vendor barrel indirection |
| `sdk/src/vite/directiveModulesDevPlugin.mts` | 14–38 | `generateVendorBarrelContent` — iterates `clientFiles`, uses same keys for export |
| `sdk/src/vite/directiveModulesDevPlugin.mts` | 93–121 | Scan triggered here for dev server; vendor barrel written to disk post-scan |
| `sdk/src/vite/createViteAwareResolver.mts` | 349 | `symlinks: envResolveOptions.preserveSymlinks` — symlink inversion |
| `sdk/src/runtime/imports/ssr.ts` | 11 | Error throw site: `(ssr) No module found for '${id}'…` |
| `sdk/src/runtime/imports/client.ts` | 13 | Error throw site: `(client) No module found for '${id}'…` |
| `sdk/src/vite/directivesFilteringPlugin.mts` | 37–48 | `this.getModuleInfo(absoluteId)` — uses real paths; symlinked keys would miss |
| `sdk/src/lib/normalizeModulePath.mts` | — | Path normalization: project-relative → Vite-style `/…` path |
| `sdk/src/lib/constants.mts` | 27 | `VENDOR_CLIENT_BARREL_EXPORT_PATH = "rwsdk/__vendor_client_barrel"` |

### Tier 2 — Derived empirical

| Artifact | What it shows |
|----------|---------------|
| `npm pack lucide-react@1.7.0` + tarball extraction | Confirmed `dist/esm/Icon.js` exists and contains `"use client"` at line 2 |
| Import chain trace through extracted tarball | `index.js` → icon file → `createLucideIcon.js` → `Icon.js` |

### Tier 3 — Secondary

| Source | What it shows |
|--------|---------------|
| lucide-react v1.7.0 changelog | `'use client'` added as part of RSC compatibility marking |
| pnpm documentation on symlink structure | `node_modules/X` → `node_modules/.pnpm/X@ver/node_modules/X` pattern |

---

## Unresolved Questions

1. **Is the bug dev-mode only?**
   The crash occurs in the esbuild dep-optimization transform, which runs during `vite dev`. In production Rollup builds, Vite resolves symlinks to real paths before passing `id` to the `transform` hook — which would match the `clientFiles` keys and avoid the mismatch. However, this was not confirmed with an actual production build test against a pnpm project using lucide-react v1.7.0. An implementer applying the fix should test both dev and prod modes.

2. **Does Option B break `directivesFilteringPlugin`?**
   The risk that storing symlinked paths in `clientFiles` would cause `directivesFilteringPlugin`'s `this.getModuleInfo()` calls to fail (because Rollup uses real paths as module IDs) is assessed from reading the code. It has not been confirmed by writing a failing test. This is sufficient justification to prefer Option A, but the Option B risk should be empirically confirmed before it is formally ruled out.

---

## Implications

### For the fix implementer

Option A is a minimal, surgical change: one call to `fsp.realpath()` in `directivesPlugin.mts` before computing `normalizedPath`. It mirrors the pattern already established in `runDirectivesScan.mts`. The `fsp` import is already available in that file. No other files need changes.

The fix should be tested with a pnpm project that imports lucide-react ≥ v1.7.0, verifying that:
1. Dev mode (`vite dev`) no longer throws the module lookup error.
2. The vendor barrel correctly serves `Icon.js` (visible via network inspector or VERBOSE logging).
3. Production build (`vite build`) continues to work.

### Broader scanner design consideration

Any npm package that adds `'use client'` to a transitive dependency (not just the package entry point) will trigger the same latent bug in pnpm projects. lucide-react is not unique — any component library following RSC conventions could do this. Option A fixes the general case: once applied, `args.path` is always resolved to its real filesystem path before key computation, regardless of which package introduced the directive.

The pattern of "scan uses `realpath`, but transform does not" is the root design inconsistency. After the fix, both sides of the path key agreement use `realpath`.

### On intentionality of node_modules scanning

There is dedicated infrastructure confirming that node_modules client files are **intended** to be scanned and handled:
- The vendor barrel mechanism in `directiveModulesDevPlugin.mts` exists specifically for node_modules entries in `clientFiles`.
- The lookup map generator in `createDirectiveLookupPlugin.mts` has an explicit `node_modules` branch.
- The `createDirectiveLookupPlugin.mts` `configEnvironment` hook explicitly **skips** adding node_modules files to `optimizeDeps.entries` (lines 151–154) — confirming they are handled differently, not ignored.

Excluding node_modules from the scan would be the wrong direction; it would break the intended design.
