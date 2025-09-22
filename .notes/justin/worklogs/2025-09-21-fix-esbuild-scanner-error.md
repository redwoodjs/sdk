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

## Document Component Type Investigation

Initially attempted to fix Document component type issues by changing from `React.FC<{ children: React.ReactNode }>` to `DocumentProps`. However, this approach was incorrect - the Document components should maintain their simple signature as they are user-controlled templates that only need to render children.

The Document component changes were reverted to maintain the original, correct type signature across all starters and playground examples.

## Broken Symlinks in Tarball Installation

After fixing the Document component types, the CI tests were still failing with `Cannot find module` errors for `typescript`.

An investigation revealed that the issue was caused by broken symbolic links in the `node_modules` directory of the temporary test environments. The monorepo uses `pnpm`, which creates symlinked `node_modules`. The E2E test setup was copying these directories, including the now-broken symlinks, into the temporary test environment.

When `npm install` was run in the temporary directory, it failed to correctly resolve dependencies due to the presence of these broken symlinks.

The fix, confirmed by manual testing, is to remove the existing `node_modules` directory and any lock files (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`) from the temporary directory before running `npm install`. This ensures a clean, fresh installation without interference from the pre-existing broken symlinks.

## Code Deduplication and Refactoring

Identified significant code duplication between smoke tests and tarball setup for copying projects to temporary directories. Both were implementing similar logic for:
- Copying project files while excluding `node_modules`
- Respecting `.gitignore` patterns
- Installing dependencies
- Replacing workspace dependencies

Refactored to create a shared `copyProjectToTempDir` function in `environment.mts` that handles both use cases:
- Extended the function to support both 'smoke' and 'tarball' test types
- Added tarball-specific configuration (frozen lockfile settings)
- Added `installTarballDependencies` function for tarball installation
- Simplified `setupTarballEnvironment` to use the shared function

This eliminates code duplication and ensures both smoke tests and E2E tests use the same reliable file copying and dependency installation logic, including proper `.gitignore` respect and cross-platform compatibility via `fs-extra`.

## Redundant Type Checks

The explicit `npm run check` calls were removed from the E2E and smoke test infrastructure. It was discovered that these checks were redundant. The `npm run generate` command, which is a necessary step in both testing setups to generate application types, already includes a type-checking step.

Running the type check separately was problematic because it would run before the necessary types had been generated. Relying on the `generate` script's built-in type check ensures that types are checked at the correct point in the process, resolving the CI failures.

## PR Description

### Manual Changes and Fixes

This PR includes manual changes to address issues that arose from the automated dependency updates.

#### Problem

The update to Vite from version `7.1.5` to `7.1.6` introduced a breaking change via an internal update to its `esbuild` dependency (from `^0.23.0` to `^0.24.0`).

This new version of `esbuild` changed its API behavior, making it an error to use `write: false` with multiple entry points and `bundle: true` without specifying an `outdir`. This directly impacted our custom directive scanner, causing the build to fail. A follow-up issue also arose where the scanner attempted to process virtual modules from Vite's config, which `esbuild` cannot handle.

#### Solution

1.  **Updated Directive Scanner**: The scanner's `esbuild` configuration was updated to be compatible with the new API. This involved adding a temporary `outdir` to the configuration and filtering out virtual modules from the entry points before the scan.
2.  **Switched to Tarball-Based Testing**: The investigation revealed that the existing E2E test setup, which relied on workspace linking, was running against stale dependencies from `node_modules` that were installed before the dependency upgrade. This meant the CI was not testing against the new versions and their updated types, hiding the build failures. The test environments for both smoke and E2E tests were switched to use a tarball-based installation. This ensures tests run in a clean, isolated environment with the correct, newly-updated dependencies, accurately reflecting a real user installation and validating the build fixes.

## `vite-plugin-cloudflare` Build Process Conflict

After fixing the scanner and type issues, a series of build failures pointed to a deep incompatibility between our multi-pass build process and recent changes in `@cloudflare/vite-plugin` (v1.13.3) and Vite/Rollup.

### Problem

The core issue stemmed from two conflicting requirements:

1.  **Cloudflare Plugin Requirement**: The updated `@cloudflare/vite-plugin` asserts that the main entry chunk for a worker build *must* be named `index`. To achieve this, Rollup's `input` option must be an object with an `index` key (e.g., `{ index: '...' }`).
2.  **Rollup Requirement**: A recent Vite/Rollup update prohibits the use of `output.inlineDynamicImports: true` (which is essential for creating a single-file worker bundle) when the `input` option is an object. Rollup now requires a simple string input for this option.

This created a deadlock: our build process needed to produce a single file, which required `inlineDynamicImports: true`, but the Cloudflare plugin's requirement for an `index` chunk forced an input configuration that Rollup rejected.

### Investigation

Analysis of the `@cloudflare/vite-plugin` playground examples revealed that the plugin is designed to manage the entire worker build configuration implicitly when a simple setup is detected. Our highly customized, multi-pass build in `buildApp.mts`, which manually configured Rollup options, was interfering with the plugin's intended operation.

The architecture (`docs/architecture/productionBuildProcess.md`) confirms a two-pass worker build is essential: a "discovery" pass to produce an intermediate bundle and a "linker" pass to produce the final, single-file artifact. The solution needed to respect this architecture while yielding control of the Rollup configuration to the Cloudflare plugin.

### Solution

The solution was to stop fighting the plugin and instead adapt our build orchestrator (`buildApp.mts`) to work with it:

1.  **Remove Manual Rollup Config**: In `sdk/src/vite/configPlugin.mts`, all manual `rollupOptions` for the worker build were removed. This allows the `@cloudflare/vite-plugin` to inject its own, correct configuration for generating a single-file worker bundle with an `index` chunk.

2.  **Adapt the Linker Pass**: The linker pass in `buildApp.mts` was updated. Instead of defining its own `rollupOptions`, it now modifies the *existing* configuration that the plugin created. It re-points the `index` entry to the intermediate worker artifact from the first pass (`dist/worker/index.js`).

    ```typescript
    // in buildApp.mts, during the linker pass
    const workerConfig = workerEnv.config;
    workerConfig.build!.emptyOutDir = false;
    workerConfig.build!.rollupOptions!.input = {
      index: resolve(projectRootDir, "dist", "worker", "index.js"),
    };
    ```

This approach resolves the conflict by allowing the Cloudflare plugin to control the build process as intended, while our orchestrator hooks into the process to execute the necessary multi-pass logic. This ensures the final `worker.js` is a single, correctly transformed bundle that meets the requirements of both Rollup and the Cloudflare runtime.

## SSR Build Failure and Reversion

The previous fix, which involved letting the Cloudflare plugin manage the worker build, was successful. However, a follow-up build failure occurred:

```
[vite]: Rollup failed to resolve import ".../ssr_bridge.js" from ".../index.js".
```

### Investigation

This error indicated that the linker pass could not find the `ssr_bridge.js` artifact. The root cause was an unnecessary change I had made to the SSR build configuration in `sdk/src/vite/configPlugin.mts`.

In an earlier attempt to fix the `inlineDynamicImports` error, I had changed both the `worker` and `ssr` build inputs from an object to a string. While the `worker` build change was the source of the conflict with the Cloudflare plugin, the change to the `ssr` build was an incorrect overreach. The `ssr` environment is not processed by the Cloudflare plugin and did not have the same issue.

My incorrect modification to the SSR config's `lib.entry` caused the `ssr_bridge.js` to be bundled in a way that the linker pass could no longer resolve.

### Solution

The fix was to revert the `ssr` build configuration in `sdk/src/vite/configPlugin.mts` to its original state, which uses an object for `lib.entry` to correctly name the output chunk. The `worker` build changes were kept, as they were the correct fix for the Cloudflare plugin conflict.

This reversion ensures the SSR artifact is produced correctly, allowing the linker pass to resolve it and complete the build.
