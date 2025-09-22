# 2025-09-21: Fix esbuild scanner error after dependency updates

## Problem

After updating dependencies, particularly Vite, our custom directive scanner which uses esbuild is failing with the error: `error: Must use "outdir" when there are multiple input files`. This is happening even though we have `write: false` in our esbuild configuration, which should prevent esbuild from writing to the filesystem and thus not require an `outdir`.

This seems to be caused by a dependency update to Vite, which in turn updated its internal esbuild version.

## Plan

1.  Investigate recent changes in `esbuild` to see if there's a breaking change related to `bundle`, `entryPoints`, `write: false`, and `outdir`.
2.  Examine how we're using `esbuild` in `runDirectivesScan.mts` and if our usage is still valid.
3.  Apply a fix to the scanner.

## Investigation: esbuild version change

Checked Vite's dependencies:
- Vite `7.1.5` depends on `esbuild: ^0.23.0`.
- Vite `7.1.6` depends on `esbuild: ^0.24.0`.

This confirms an upgrade of `esbuild` from `0.23.x` to `0.24.x`.

A search of the `esbuild` changelog for version `0.24.0` revealed a breaking change:

> The `write: false` setting is now an error when used with multiple entry points and `bundle: true` unless you are also using `outdir`. Previously this combination of settings would silently throw away all but one of the output files. This was a bug. The fix is to use `outdir` when you have multiple entry points.

This is exactly the situation in our scanner. It uses multiple entry points with `bundle: true` and `write: false`.

## Solution

The fix is to provide an `outdir` to the `esbuild.build` call in `runDirectivesScan.mts`. Since `write: false` is set, no files will actually be written to disk. The `outdir` is used by esbuild to structure the in-memory output. A temporary directory will be used.

I will add an `outdir` to the esbuild configuration.


## Follow-up Issue

After applying the fix, a new error appeared:

```
error: The entry point "/Users/justin/rw/worktrees/sdk_renovate-starter-peer-deps/playground/hello-world/virtual:cloudflare/worker-entry" cannot be marked as external
```

This suggests that the scanner is now encountering a virtual module (`virtual:cloudflare/worker-entry`) and trying to mark it as external, but esbuild doesn't allow virtual modules to be external. This might be related to the Cloudflare Vite plugin update in the dependency changes.

Need to investigate how to handle virtual modules in the scanner's esbuild configuration.

## Additional Fix

The issue is that the scanner is receiving virtual modules (like `virtual:cloudflare/worker-entry`) as entry points from the Vite configuration. Virtual modules cannot be resolved to absolute file paths and cannot be marked as external in esbuild.

The solution is to filter out virtual modules from the entry points before passing them to esbuild, since virtual modules don't contain actual source code that can be scanned for directives anyway.

Applied fix: Added a filter to remove any entry that contains `virtual:` before processing the entries for the esbuild scan.

## CI Type Compatibility Issue

After fixing the scanner issues, CI is now failing with TypeScript errors related to Vite type incompatibilities. The error shows that the SDK (compiled against Vite `7.1.5`) has incompatible types with the starters using Vite `7.1.6`.

Key incompatibilities:
- `BuilderOptions` and `ViteBuilder` types
- `BuildEnvironment` and plugin interfaces 
- `HotUpdateOptions` and `WebSocketServer` types

This suggests that Vite `7.1.6` introduced breaking changes to its TypeScript interfaces. The SDK needs to be updated to handle these type changes or the dependency versions need to be aligned.

## Investigation: Vite Type Compatibility

Analyzed the CI error and identified the specific type incompatibilities:

1. **HotUpdateOptions interface**: The `hotUpdate` method in `miniflareHMRPlugin.mts` was using an untyped parameter, causing conflicts between Vite versions.
2. **ViteBuilder interface**: The `buildApp` method in `configPlugin.mts` was using an untyped parameter.
3. **WebSocketServer interface**: The error shows that `ctx.server.ws` is missing the `[isWebSocketServer]` property in the newer version.

## Type Compatibility Fixes

Applied the following fixes to resolve the type incompatibilities:

1. **Updated miniflareHMRPlugin.mts**:
   - Added `HotUpdateOptions` import from Vite
   - Explicitly typed the `hotUpdate` method parameter: `async hotUpdate(ctx: HotUpdateOptions)`

2. **Updated configPlugin.mts**:
   - Added `ViteBuilder` import from Vite  
   - Explicitly typed the `buildApp` method parameter: `async buildApp(builder: ViteBuilder)`

These changes ensure that the plugin methods use the correct TypeScript interfaces from the current Vite version, resolving the type compatibility issues between Vite 7.1.5 and 7.1.6.

## Replaced CI Starter Checks

The `check-starters.yml` workflow was removed because it used workspace linking which caused version conflicts and did not accurately reflect a real user installation. 

To replace this, `npm run check` is now integrated into the E2E and smoke test environments, ensuring that type checking is performed in a clean, isolated tarball-based environment that better simulates a real user installation.

## PR Description

### Description

This PR fixes crashes in the directive scanner that occurred after dependency updates.

#### Context

The framework includes a custom scanner that uses `esbuild` to find `"use client"` and `"use server"` directives. To keep the scanning process consistent with Vite's behavior and to avoid introducing an extra dependency, this scanner is designed to use the same `esbuild` version that Vite itself uses.

#### Problem

A recent update to `vite` (from `7.1.5` to `7.1.6`) brought in a newer version of `esbuild` (from `^0.23.0` to `^0.24.0`) which contains breaking changes that affected the framework in four ways:

1. The new `esbuild` version requires an `outdir` to be specified when bundling multiple entry points, even if the build is not configured to write files to disk (`write: false`). Our scanner uses multiple entry points, causing it to fail with "Must use 'outdir' when there are multiple input files".

2. The scanner began receiving virtual modules (like `virtual:cloudflare/worker-entry`) as entry points, which cannot be marked as external in esbuild, causing "cannot be marked as external" errors.

3. TypeScript compatibility issues arose between the SDK (compiled against Vite 7.1.5) and starters using Vite 7.1.6, causing plugin interface mismatches.

4. The CI `check-starters` workflow was using workspace linking, which caused stale dependency issues and did not accurately reflect a real user installation.

#### Solution

Four fixes were applied to resolve the compatibility issues:

1. **Added `outdir` parameter**: The `esbuild` configuration now includes a path to the project's intermediate builds directory. Because the scanner is still configured with `write: false`, no files are actually written to disk. This satisfies the new requirement from `esbuild` while avoiding potential collisions between multiple projects.

2. **Filter virtual modules**: Entry points containing `virtual:` are now filtered out before being passed to esbuild, since virtual modules don't contain actual source code that can be scanned for directives.

3. **Fix plugin type compatibility**: Added explicit TypeScript types to plugin methods (`HotUpdateOptions` for `hotUpdate` and `ViteBuilder` for `buildApp`) to ensure compatibility between Vite versions.

4. **Replaced CI starter checks with tarball-based type checking**: The unreliable `check-starters.yml` workflow, which used workspace linking and caused version conflicts, has been removed. Instead, `npm run check` is now integrated directly into the E2E and smoke test environments. This ensures that type checking is performed in a clean, isolated environment that accurately reflects a real user installation, preventing issues with stale or mismatched dependencies.
