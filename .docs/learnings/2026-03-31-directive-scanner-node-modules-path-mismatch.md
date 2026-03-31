# Directive Scanner `node_modules` Path Mismatch in pnpm Workspaces

**Date**: 2026-03-31
**Status**: Root cause identified; fix not yet implemented
**Packages affected**: rwsdk Vite plugin (dev mode)
**Trigger**: Any `node_modules` package containing `'use client'` or `'use server'` directives in a pnpm workspace, notably lucide-react v1.7.0+

---

## Summary

The directive scanner crashes when processing `'use client'` / `'use server'` directives in `node_modules` packages within pnpm workspaces. The crash message is:

```
No module found for /node_modules/lucide-react/dist/esm/Icon.js in module lookup for use client directive
```

The root cause is a **key format mismatch**: the scanner adds `node_modules` files to its tracking sets using their resolved pnpm store absolute path (e.g., `/home/user/node_modules/.pnpm/lucide-react@.../node_modules/lucide-react/dist/esm/Icon.js`), but the SSR module graph only contains entries under the original relative `node_modules` path (e.g., `lucide-react/dist/esm/Icon.js`). The SSR lookup fails because the keys do not match.

---

## Root Cause

The failure chain involves four steps:

### Step 1 — Scanner resolves symlinks

In pnpm workspaces, `node_modules` packages are symlinks to the pnpm content-addressable store. The directive scanner (`runDirectivesScan.mts`) calls `fs.realpathSync` on every module it processes:

```typescript
// sdk/src/vite/runDirectivesScan.mts:382
const realPath = await fsp.realpath(args.path);
```

For `playground/kitchen-sink/node_modules/lucide-react/dist/esm/Icon.js`, this resolves to:
```
/home/vscode/repo/node_modules/.pnpm/lucide-react@1.7.0_react@19.3.0-canary-4fdf7cf2-20251003/node_modules/lucide-react/dist/esm/Icon.js
```

### Step 2 — Scanner adds resolved path to tracking set

The resolved path is normalized and added to `clientFiles`:

```typescript
// sdk/src/vite/runDirectivesScan.mts:389
clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
```

`normalizeModulePath` returns the absolute path unchanged when the path is outside the project root (since the pnpm store path is not inside `playground/kitchen-sink/`). So `clientFiles` contains the pnpm store path as the key.

### Step 3 — Vendor barrel generated with store paths as keys

`generateVendorBarrelContent` in `directiveModulesDevPlugin.mts` generates the vendor barrel:

```typescript
// sdk/src/vite/directiveModulesDevPlugin.mts:22-33
const imports = [...files]
  .filter((file) => file.includes("node_modules"))
  .map((file, i) =>
    `import * as M${i} from '${normalizeModulePath(file, projectRootDir, {
      absolute: true,
    })}';`,
  )
  .join("\n");

const exports = "export default {\n" +
  [...files]
    .filter((file) => file.includes("node_modules"))
    .map((file, i) =>
      `  '${normalizeModulePath(file, projectRootDir)}': M${i},`,
    )
    .join("\n") + "\n};";
```

Both the import source and the export key use the pnpm store path. The generated barrel looks like:

```javascript
import * as M0 from '/home/vscode/repo/node_modules/.pnpm/lucide-react@.../node_modules/lucide-react/dist/esm/Icon.js';
export default {
  '/home/vscode/repo/node_modules/.pnpm/lucide-react@.../node_modules/lucide-react/dist/esm/Icon.js': M0,
};
```

### Step 4 — SSR lookup fails on key mismatch

`createDirectiveLookupPlugin.mts` generates the `useClientLookup` map from the `clientFiles` set, which uses pnpm store paths as keys:

```typescript
// sdk/src/vite/createDirectiveLookupPlugin.mts:31-33
if (file.includes("node_modules") && isDev) {
  return `
  "${file}": () => import("${barrelPath}").then(m => m.default["${file}"]),
`;
}
```

At runtime, `ssrLoadModule` in `sdk/src/runtime/imports/ssr.ts` looks up the module ID:

```typescript
// sdk/src/runtime/imports/ssr.ts:7-8
const loader = useClientLookup[id];
if (!loader) throw new Error(`No module found for ${id} in module lookup for use client directive`);
```

Vite's optimizer pre-bundles `node_modules` imports using the original import specifier (e.g., `lucide-react/dist/esm/Icon.js`), not the pnpm store path. When SSR calls `ssrLoadModule` with the original relative path, the lookup key `lucide-react/dist/esm/Icon.js` does not exist in `useClientLookup` — only the pnpm store path key does. The lookup throws.

---

## Why Project-Local Paths Don't Fail

Project-local files (e.g., `src/pages/index.tsx`) are normalized to Vite-style relative paths (`/src/pages/index.tsx`). These relative paths are consistent across the scanner, barrel, and Vite's module graph — all three use the same key format. There is no mismatch.

The failure is specific to `node_modules` in pnpm workspaces because:
1. `fs.realpathSync` resolves the symlink to an absolute store path
2. The absolute store path is outside the project root, so `normalizeModulePath` returns it unchanged
3. Vite's optimizer does not use the store path — it uses the original import specifier

---

## Architectural Context

### What rwsdk's directive scanning is designed for

The directive scanner identifies **client and server entry points** at the worker/SSR boundary. When a file has `'use client'`, it is a client entry point (should not run in SSR). When a file has `'use server'`, it is a server entry point (should only run in SSR).

The system is designed around the **import graph** of the project's own code — the files that are imported by the worker entry point.

### Why scanning `node_modules` is unnecessary

`'use client'` in third-party packages (like lucide-react) is a **webpack/Next.js convention**. It signals to webpack: "do not include this module in the server bundle." rwsdk's architecture handles client components differently: React's runtime on the client handles which components are client components. The directive scanner exists to identify entry points for the worker/SSR boundary, not to re-implement webpack's server/client bundle splitting for third-party packages.

Third-party packages that add `'use client'` do so for their own bundler's behavior — not for rwsdk. Including them in the directive scanning is unnecessary and introduces fragility (as evidenced by this bug).

---

## Fix Options

### Option A — Normalize `node_modules` keys to relative paths

Modify the scanner or `normalizeModulePath` to convert pnpm store paths back to their original `node_modules` relative paths (e.g., strip the `.pnpm/.../node_modules/` prefix).

**Tradeoffs**:
- Preserves directive support for `node_modules` packages (arguably unnecessary)
- Fragile: requires parsing pnpm store path format, which varies across pnpm versions and operating systems
- Risk of breaking path de-duplication if two packages resolve to the same store path

### Option B — Skip `node_modules` in directive scanning

Filter out `node_modules` entries from the vendor barrel. Third-party `'use client'` / `'use server'` directives are not meaningful for rwsdk's architecture.

**Tradeoffs**:
- Architecturally correct: aligns with the actual purpose of directive scanning
- Avoids the pnpm store path problem entirely
- Simple: one-line filter change
- Cons: if a future `node_modules` package legitimately needs directive handling, this would suppress it (but this scenario is extremely unlikely in practice)

### Option C — Normalize in `normalizeModulePath`

Modify `normalizeModulePath` to detect pnpm store paths and return the original `node_modules` path instead of the store path.

**Tradeoffs**:
- Fixes the root cause in one place
- Affects all callers of `normalizeModulePath` — potential unintended side effects
- Still requires pnpm store path parsing

### Recommended Fix

**Option B** is the recommended approach. The fix should update `generateVendorBarrelContent` in `sdk/src/vite/directiveModulesDevPlugin.mts` to exclude `node_modules` entries from the vendor barrel. Note: both the import filter (line 19) and the export key filter (line 31) need to be updated consistently. Changing only one will cause a mismatch between imports and exports.

Example implementation:

```typescript
// sdk/src/vite/directiveModulesDevPlugin.mts

// For imports:
.filter((file) => file.includes("node_modules") && !isPnpmStorePath(file))

// For exports:
.filter((file) => file.includes("node_modules") && !isPnpmStorePath(file))
```

Where `isPnpmStorePath` detects paths containing `.pnpm/` segments.

Alternatively, simply exclude all `node_modules` from the vendor barrel (since third-party directives are not meaningful for rwsdk):

```typescript
.filter((file) => !file.includes("node_modules"))
```

This would remove `node_modules` entries from both imports and exports, which is the simplest correct fix.

---

## Follow-Up Items

1. **`serverFiles` may have the same issue.** The server barrel (`rwsdk-vendor-server-barrel.js`) is generated by the same `generateVendorBarrelContent` function and would be subject to the same key mismatch for any `'use server'` directive in a `node_modules` package. Verify and fix if needed.

2. **Verify fix works for non-pnpm setups.** The fix should be tested in both pnpm and non-pnpm environments (npm, yarn) to ensure vendor barrels still work correctly for `node_modules` directives that don't involve symlinks.

3. **Consider whether the scanner should traverse into `node_modules` at all.** The scanner's import graph traversal (`findImports` in esbuild) follows all imports, including those into `node_modules`. If `node_modules` directives are not actionable for rwsdk, the scanner could be modified to skip `node_modules` entirely during graph traversal — not just during barrel generation.

4. **The error message could be improved.** The current error ("No module found for X in module lookup for use client directive") is misleading when the actual issue is a key format mismatch, not a missing module. Consider improving the error message to help users understand the actual cause.

---

## Evidence

- **Scanner instrumentation**: Added `console.log` to `runDirectivesScan.mts` onLoad hook. Confirmed scanner adds lucide `Icon.js` with pnpm store path: `[SCANNER DEBUG] Added to clientFiles: /home/vscode/repo/node_modules/.pnpm/lucide-react@1.7.0_.../node_modules/lucide-react/dist/esm/Icon.js | isNodeModules: true`
- **Barrel content**: Read `sdk/dist/__intermediate_builds/rwsdk-vendor-client-barrel.js`. Confirmed both import source and export key use the pnpm store path.
- **SSR barrel**: Read `playground/kitchen-sink/node_modules/.vite/deps_ssr/rwsdk___vendor_client_barrel.js`. Confirmed export key is the pnpm store path.
- **Worker deps barrel**: Read `playground/kitchen-sink/node_modules/.vite/deps_worker/rwsdk___vendor_client_barrel.js`. Confirmed it calls `ssrLoadModule` with the pnpm store path.
- **`normalizeModulePath` behavior**: Confirmed that for paths outside project root, both default and `{absolute: true}` modes return the absolute path unchanged.
- **SSR bridge error**: Confirmed exact error message format in `sdk/src/runtime/imports/ssr.ts:8` matches the reported crash message.

---

## Files Involved

| File | Role |
|---|---|
| `sdk/src/vite/runDirectivesScan.mts` | Scans for directives; calls `realpathSync` and adds to `clientFiles`/`serverFiles` |
| `sdk/src/vite/directiveModulesDevPlugin.mts` | Generates vendor barrel content from `clientFiles`/`serverFiles` |
| `sdk/src/vite/createDirectiveLookupPlugin.mts` | Generates `useClientLookup` virtual module from tracking sets |
| `sdk/src/runtime/imports/ssr.ts` | Runtime SSR loader that performs the failing lookup |
| `sdk/src/lib/normalizeModulePath.mts` | Normalizes module paths; returns absolute path for pnpm store paths |
