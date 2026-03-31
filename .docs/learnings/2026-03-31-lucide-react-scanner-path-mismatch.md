# lucide-react v1.7.0 Scanner Crash: Root Cause Investigation

## Problem

The lucide-react v1.7.0 scanner crashes at runtime when processing vendor packages that have `use client` directives in their icon files. The scanner generates a barrel file and a lookup map, and at runtime the lookup fails to find the expected exports.

## Root Cause

The bug is a **barrel-internal path format inconsistency**, not the previously hypothesized barrel-lookup key mismatch.

### Detailed Analysis

The scanner has three key stages:

**Stage 1 — Directive Scan** (`runDirectivesScan.mts:389`)

```ts
clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
```

Stores the normalized file path in `clientFiles` Set. For a real absolute path like `/Users/test/project/node_modules/lucide-react/dist/esm/icons/activity.js`, `normalizeModulePath` returns the Vite-style form `/node_modules/lucide-react/dist/esm/icons/activity.js` (no `absolute: true` option, so it strips the project root prefix).

**Stage 2 — Lookup Map** (`createDirectiveLookupPlugin.mts:32`)

```ts
"${file}": () => import("rwsdk/__vendor_client_barrel").then(m => m.default["${file}"]),
```

Uses the Set value directly as the lookup key. Since the Set already contains the Vite-style path, the lookup key is `/node_modules/lucide-react/dist/esm/icons/activity.js`.

**Stage 3 — Barrel Generation** (`directiveModulesDevPlugin.mts:22 and 33`)

```ts
// Line 22 — Import (has { absolute: true })
.map((file, i) =>
  `import * as M${i} from '${normalizeModulePath(file, projectRootDir, { absolute: true })}';`)

// Line 33 — Export key (NO { absolute: true })
.map((file, i) => `  '${normalizeModulePath(file, projectRootDir)}': M${i},`)
```

The barrel import and export use **different** `normalizeModulePath` invocations:
- Import: `normalizeModulePath(file, projectRootDir, { absolute: true })` → `/Users/test/project/node_modules/lucide-react/dist/esm/icons/activity.js` (absolute)
- Export: `normalizeModulePath(file, projectRootDir)` → `/node_modules/lucide-react/dist/esm/icons/activity.js` (Vite-style)

## Empirical Evidence

Using actual `path.resolve` from Node.js, for the real absolute path `/Users/test/project/node_modules/lucide-react/dist/esm/icons/activity.js`:

| Location | Code | Output |
|---|---|---|
| Scan (389) | `normalizeModulePath(realPath, root)` | `/node_modules/lucide-react/...` |
| Lookup (32) | `${file}` (from Set) | `/node_modules/lucide-react/...` |
| Barrel Import (22) | `normalizeModulePath(..., { absolute: true })` | `/Users/test/project/node_modules/lucide-react/...` |
| Barrel Export (33) | `normalizeModulePath(..., undefined)` | `/node_modules/lucide-react/...` |

**Barrel export key and lookup key match** — the hypothesized mismatch does NOT occur.

**Barrel import and barrel export key do NOT match** — this IS the bug.

## Why Tests Pass

The existing tests in `directiveModulesDevPlugin.test.mts` and `createDirectiveLookupPlugin.test.mts` use test data with relative paths (e.g., `node_modules/lib-a/index.js`) that coincidentally normalize to the same Vite-style format as the barrel export key. The tests verify that barrel export keys are correct but do **not** verify that the barrel import paths would resolve to the same module. This masks the internal inconsistency.

All 458 existing tests pass.

## File Citations

| File | Line(s) | Role |
|---|---|---|
| `sdk/src/vite/runDirectivesScan.mts` | 389 | Stores normalized path in `clientFiles` Set |
| `sdk/src/vite/createDirectiveLookupPlugin.mts` | 32 | Uses Set value as lookup key (no extra normalize) |
| `sdk/src/vite/directiveModulesDevPlugin.mts` | 22 | Barrel import: uses `normalizeModulePath(absolute: true)` |
| `sdk/src/vite/directiveModulesDevPlugin.mts` | 33 | Barrel export: uses `normalizeModulePath` WITHOUT `absolute: true` |
| `sdk/src/lib/normalizeModulePath.mts` | 48–114 | Path normalization logic |

## Hypothesized Fix Direction

The `normalizeModulePath` call on `directiveModulesDevPlugin.mts:33` should use the same `{ absolute: true }` option as the import on line 22, OR the Set should store values using `{ absolute: true }` so both locations use the same format consistently. The key requirement is that the barrel import and export must use the same path format for any given file.
