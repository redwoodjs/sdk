# Directive scanner processes node_modules without a filter

## Problem

When a third-party package in `node_modules` contains a `"use client"` or `"use server"` directive, the directive scanner in `runDirectivesScan.mts` discovers and processes the file, adds it to the `clientFiles`/`serverFiles` sets, and the resulting lookup map routes it through the vendor barrel mechanism. This can cause a runtime crash when the SSR worker attempts to load the module.

## Finding

The directive scanner has two phases:

1. **Pre-scan** (`findDirectiveRoots`, lines 33–76): globs only files in `src/`, so it never directly discovers `node_modules` files.

2. **esbuild bundle scan** (lines 430–441): calls `esbuild.build()` with `bundle: true`. This causes esbuild to recursively traverse ALL imports from source files, including vendor packages in `node_modules`.

The esbuild plugin's `onLoad` hook (lines 354–426) processes every JS/TS file in the dependency graph with **no `node_modules` filter**:

```typescript,359
if (!path.isAbsolute(args.path) || args.path.includes("virtual:") || isExternalUrl(args.path)) {
  return null; // only skips absolute paths, virtual modules, external URLs
}
// no node_modules check here!
const originalContents = await readFileWithCache(args.path);
const { moduleEnv, isClient, isServer } = classifyModule({ contents, inheritedEnv });
if (isClient) {
  clientFiles.add(normalizeModulePath(realPath, rootConfig.root)); // adds node_modules path!
}
```

There is a partial protection in `createDirectiveLookupPlugin.mts` (lines 151–154) that skips `node_modules` when populating `optimizeDeps.entries`, but this is in the Vite plugin's `configEnvironment` hook — it does NOT affect the esbuild scan.

## Evidence

- `lucide-react@1.7.0` package: `npm pack --dry-run` confirms `dist/esm/Icon.js` and `dist/esm/DynamicIcon.js` are in the published tarball
- Both files have `"use client"` on line 2
- `lucide-react/dist/esm/lucide-react.js` (the main barrel) does NOT have `"use client"`
- Standard import `{ Activity } from "lucide-react"` resolves to `lucide-react.js`, not `Icon.js`, so the crash is not triggered by normal usage
- The crash is triggered when a source file imports a path that resolves into a vendor file with `"use client"` that esbuild bundles

## Solution

Add a `node_modules` guard in the `onLoad` hook of `esbuildScanPlugin` in `runDirectivesScan.mts`:

```typescript
if (args.path.includes("node_modules")) {
  return { external: true };  // skip processing, don't add to client/server files
}
```

This prevents vendor files from being added to the directive sets. Workspace packages that should be scanned can be handled via the `forceClientPaths`/`forceServerPaths` plugin options.

## Context

Encountered during the 2026-03-31 investigation into the lucide-react v1.7.0 directive scanner crash. The scanner should only process project source files, not third-party vendor code.
