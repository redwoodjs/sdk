# Cloudflare Vite Plugin 1.15.0 Dev Server Hang

## Problem

After upgrading to `@cloudflare/vite-plugin@1.15.0`, the dev server (`pnpm dev`) hangs with no output. A user also reported an error: `Error: rwsdk: 'react-server' is not supported in this environment` when importing `rwsdk/client` in worker-side code.

## Initial Investigation

The hang occurs during dev server startup. With `DEBUG=*`, no output appears, suggesting the hang happens before any logging occurs.

## Root Cause Analysis

Added debug logging throughout the vite-plugin-cloudflare codebase to trace execution:

1. **Module loading** - logs when the plugin module loads
2. **Plugin initialization** - logs when `cloudflare()` function is called
3. **Config hook** - logs config hook execution
4. **ConfigureServer hook** - logs when configureServer runs
5. **devPlugin.configureServer** - logs Miniflare initialization, module runners, and export type fetching

The logs revealed the hang occurs at `miniflare.dispatchFetch()` when calling `GET_EXPORT_TYPES_PATH` to fetch worker export types. This happens inside `getCurrentWorkerNameToExportTypesMap()`, which is called synchronously during `configureServer`.

## Solution

Deferred the `getCurrentWorkerNameToExportTypesMap()` call until after the server is ready by moving it into the function returned from `configureServer`. In Vite, `configureServer` can return a function that runs after the server is fully initialized.

### Changes Made

Modified `/playground/hello-world/node_modules/@cloudflare/vite-plugin/dist/index.mjs`:

1. Removed the synchronous call to `getCurrentWorkerNameToExportTypesMap()` from inside the `if (ctx.resolvedPluginConfig.type === "workers")` block
2. Added the call to the function returned from `configureServer`, which executes after the server is ready

This ensures Miniflare is fully initialized and ready to handle `dispatchFetch` requests before we attempt to fetch export types.

## Results

After the change:
- Dev server starts successfully
- "VITE v7.2.2 ready in 1385 ms" message appears
- `dispatchFetch` completes successfully after the server is ready
- Export types are fetched correctly

## Observations

From the logs, there's a timing relationship between:
1. The deferred `dispatchFetch` call starting (line 42)
2. The server showing "VITE ready" message (line 45)
3. The directive scanning completing (`(rwsdk) Scanning for 'use client' and 'use server' directives...`) (lines 51-52)
4. The `dispatchFetch` completing (line 53)

The `directiveModulesDevPlugin` uses `scanPromise` to block middleware (line 113) and esbuild resolution (line 167). However, `miniflare.dispatchFetch()` calls Miniflare directly and doesn't go through Vite's middleware, so the directive scanning blocking shouldn't directly affect it. The timing correlation might be coincidental or related to dependency optimization timing.

The key fix was deferring the `getCurrentWorkerNameToExportTypesMap()` call until after the server is ready, which allows Miniflare to fully initialize before we attempt to fetch export types via `dispatchFetch`.

## Next Steps

- Test if the user-reported error (`react-server` condition issue) still occurs
- Consider if directive scanning timing needs adjustment
- Remove debug logs once stable
- Document this timing requirement if it affects other plugins

## The Deadlock Hypothesis

The previous analysis that our directive scanning block was unrelated seems incorrect. A deeper look suggests a classic deadlock is the most likely cause.

Here is the sequence of events:

1.  Vite kicks off the `configureServer` process for all plugins.
2.  The `@cloudflare/vite-plugin` runs its `configureServer` hook and calls `fetchWorkerExportTypes`.
3.  Inside `fetchWorkerExportTypes`, the plugin code executes `await this.depsOptimizer?.init()`, pausing its own execution to wait for Vite's dependency optimization to complete for the worker environment.
4.  Vite's dependency optimizer starts its work.
5.  Our `directiveModulesDevPlugin` is invoked as part of the optimizer's `esbuild` process. Its `onResolve` hook immediately executes `await scanPromise`, pausing the *entire* dependency optimization process until our directive scan is finished.

This creates a deadlock:
-   **Cloudflare's plugin** is waiting for the **dependency optimizer** to finish.
-   The **dependency optimizer** is waiting for **our directive scan** to finish.
-   Our directive scan is running, but the main thread is blocked, preventing the server from making progress that might be needed for the scan to complete or for the Cloudflare plugin to unblock.

The reason our earlier fix (deferring the Cloudflare call by returning a function from `configureServer`) worked is that it fundamentally broke this cycle. By moving the call, it ran *after* the initial `configureServer` hooks were complete. By that point, our `scanPromise` had already resolved, so the optimizer was no longer blocked when `depsOptimizer.init()` was finally called.

## Architectural Shift: Proactive Scanning via `resolveConfig`

The deadlock and race conditions are symptoms of a larger architectural problem: our directive scan is reactive, hooking into Vite's lifecycle and becoming vulnerable to its internal timing. The "blue-skying" idea of running our scan *before* Vite was the right instinct.

The blocker was needing the fully-resolved Vite config. The solution is to use Vite's programmatic `resolveConfig` API.

### New Architecture

1.  **Make `redwoodPlugin()` async:** The main plugin entry point will become an asynchronous function.
2.  **Run a "Pre-flight" Config Resolution:** Inside `redwoodPlugin()`, before returning any plugins, we will `await vite.resolveConfig()`. This gives us the final, fully-resolved Vite configuration object, including all user-defined aliases and plugins, without needing to be inside a Vite hook.
3.  **Run the Directive Scan:** With the resolved config in hand, we can now `await runDirectivesScan()`. This process will run to completion, populating our sets of client and server files.
4.  **Return the Real Plugins:** Only after the scan is 100% complete do we return our array of plugins (`directiveModulesDevPlugin`, etc.). These plugins will now receive the pre-computed scan results and will no longer need any blocking or synchronization logic.

### Benefits of this Approach

*   **We Are in Control:** The scan is guaranteed to finish before any dev server lifecycle hooks (`configureServer`, etc.) even begin. We dictate the startup sequence.
*   **No Deadlock:** The `directiveModulesDevPlugin` becomes dramatically simpler. It no longer needs to block anything. When the Cloudflare plugin calls `depsOptimizer.init()`, it will run freely.
*   **No Race Condition:** The React version mismatch is solved because our scan is done and our plugins are configured with the results *before* the optimizer starts.
*   **Architecturally Sound:** We use a stable, public Vite API to get the information we need, when we need it. This makes us far less vulnerable to future changes in Vite or its plugins.

## Implementation Status

### Completed Changes

1. **Made `redwoodPlugin()` async** - Changed the function signature to return `Promise<InlineConfig["plugins"]>`
2. **Proactive config resolution** - Added `await vite.resolveConfig()` call before returning plugins, with a guard to prevent recursion
3. **Proactive directive scan** - Moved `runDirectivesScan()` to run during the proactive config resolution
4. **Removed blocking logic** - Removed `scanPromise` and blocking logic from `directiveModulesDevPlugin`
5. **Updated type signatures** - Changed `runDirectivesScan` to accept `ResolvedConfig["environments"]` instead of `Record<string, Environment>`
6. **Fixed build compatibility** - Updated `buildApp.mts` to use `builder.config.environments` instead of `builder.environments`
7. **Plugin ordering** - Changed `knownDepsResolverPlugin` to use `enforce: "pre"` to run earlier
8. **Included resolver in proactive scan** - Added `knownDepsResolverPlugin` to the plugins array passed to proactive `resolveConfig` so its `configResolved` runs during that call

### Current Status

**Hang Issue: RESOLVED** - The dev server no longer hangs. The proactive scanning architecture successfully eliminates the deadlock.

**React Version Mismatch: PERSISTS** - Despite plugins being set up before the optimizer starts, we still see:
```
Error: Incompatible React versions: The "react" and "react-dom" packages must have the exact same version.
```

## Timing Analysis Findings

Added timing logs to trace execution order:

1. **`knownDepsResolverPlugin.configResolved`** - Logs START/END and when esbuild plugins are added
2. **`CloudflarePlugin.configureServer`** - Logs START
3. **`fetchWorkerExportTypes`** - Logs START, plugin count before `depsOptimizer.init()`, and when `init()` completes

### Key Findings from Timing Logs

```
[TIMING] knownDepsResolverPlugin.configResolved: START
[TIMING] knownDepsResolverPlugin: Added esbuild plugin for env=worker, plugin count=6
[TIMING] knownDepsResolverPlugin.configResolved: END
[TIMING] CloudflarePlugin.configureServer: START
[TIMING] fetchWorkerExportTypes: START for worker "__change_me__"
[TIMING] fetchWorkerExportTypes: esbuild plugin count BEFORE init()=7
[TIMING] fetchWorkerExportTypes: About to call depsOptimizer.init()...
[TIMING] fetchWorkerExportTypes: depsOptimizer.init() completed
```

**Critical Discovery:** The esbuild plugins ARE present (count=7) when `depsOptimizer.init()` is called. This means:

- **NOT an ordering issue** - Plugins are set up before the optimizer starts
- **Likely a configuration/functionality issue** - The esbuild plugin may not be intercepting React imports correctly, or the optimizer isn't using it as expected

The plugin count of 7 (vs 6 we added) suggests other plugins are also present, but our resolver plugin may not be functioning correctly during optimization, or the optimizer may be bypassing it somehow.

### Next Steps

1. Add logging inside the esbuild plugin's `onResolve` hook to verify it's being called during optimization
2. Verify the plugin's `onResolve` logic is correctly matching/reacting to React imports
3. Check if the optimizer is actually using the esbuild plugins from the config
4. Investigate why the resolver plugin isn't preventing the React version mismatch despite being present

## Critical Discovery: SSR Environment Contamination

After adding `runInlinedModule` logging to trace module evaluation order, a critical pattern emerged:

### The SSR Environment is Being Evaluated in Worker Context

**Timeline from logs:**
1. Lines 40-56: Worker environment modules load correctly (`deps_worker`)
2. Line 58: Directive scanning starts
3. **Line 66: `virtual:rwsdk:ssr:rwsdk/__ssr_bridge`** - SSR bridge is loaded!
4. Lines 67-70: More SSR modules (`virtual:rwsdk:ssr:`)
5. **Line 71: `(ssr) ✨ new dependencies optimized: react-dom/server.edge`** - SSR environment is optimized!
6. Line 85: `virtual:rwsdk:ssr:/node_modules/.vite/deps_ssr/react-dom_server__edge.js` - SSR React DOM loads
7. Line 95: Error occurs in SSR context: `/react-dom_server__edge.js?v=aa5dc24f/virtual:rwsdk:ssr:/node_modules/.vite/deps_ssr/react-dom_server__edge.js`

### Key Observations

1. **The error is in SSR environment, not worker** - Despite the Cloudflare plugin calling `depsOptimizer.init()` for the worker environment, the React version mismatch error occurs when SSR code is evaluated.

2. **SSR code is being evaluated during worker startup** - The `rwsdk/__ssr_bridge` virtual module is loaded (line 66), which suggests something in the worker code path is importing SSR code.

3. **SSR dependencies are being optimized** - Line 71 shows SSR environment dependencies are optimized, even though we only called `init()` for the worker environment. This suggests either:
   - Multiple environments are being optimized simultaneously
   - SSR optimization is triggered by SSR code being imported/evaluated
   - There's cross-environment contamination

4. **Connection to user's original error** - The user reported `Error: rwsdk: 'react-server' is not supported in this environment` when importing `rwsdk/client` in worker code. This suggests incorrect package.json exports resolution. If SSR code is being evaluated in worker context, that could explain why `react-server` condition is being matched incorrectly.

### Hypothesis

The SSR environment is being evaluated/optimized because:
- Something in the worker code path imports SSR code (possibly through `rwsdk/__ssr_bridge`)
- This triggers SSR environment evaluation
- SSR dependencies get optimized, but our esbuild plugin may not be applied correctly to SSR environment
- The React version mismatch occurs because SSR React DOM is loaded with mismatched React version

### Questions to Investigate

1. Why is `rwsdk/__ssr_bridge` being loaded during worker startup?
2. Is SSR environment optimization happening independently, or triggered by SSR code evaluation?
3. Are our esbuild plugins being applied to SSR environment optimization?
4. Is there a timing issue where SSR optimization happens before our plugins are fully set up?

## Root Cause: Cloudflare Plugin's Export Type Detection

After reviewing the Cloudflare plugin's CHANGELOG for version 1.15.0, the root cause became clear:

### The `ctx.exports` Feature

In version 1.15.0, Cloudflare added support for `ctx.exports`. To determine what exports should be included, **the plugin runs the user's Worker entry module during dev server startup** to detect the exports.

From the CHANGELOG:
> "We now run the code in the user's Worker entry module when starting the dev server to determine the exports that should be included."

### The Chain of Events

1. **Cloudflare plugin calls `fetchWorkerExportTypes()`** - This happens during `configureServer` (line 36 in logs)
2. **Worker entry module is executed** - To detect exports, the plugin runs the worker entry code
3. **Worker entry imports SSR code** - The worker entry likely imports `rwsdk/__ssr_bridge` or other SSR-related code
4. **SSR environment is evaluated** - When SSR code is imported, Vite evaluates it in the SSR environment context
5. **SSR dependencies are optimized** - SSR environment optimization is triggered (line 71: `(ssr) ✨ new dependencies optimized`)
6. **React version mismatch occurs** - SSR React DOM is loaded with mismatched React version because our esbuild plugin may not be applied correctly to SSR optimization, or SSR optimization happens before our plugins are set up

### Connection to User's Original Error

The user reported: `Error: rwsdk: 'react-server' is not supported in this environment` when importing `rwsdk/client` in worker-side code.

This makes sense now:
- The Cloudflare plugin runs the worker entry module to detect exports
- If the worker entry imports `rwsdk/client` or other client/SSR code, it triggers evaluation in the wrong context
- Package.json exports conditions (`react-server`, `workerd`, etc.) may be matched incorrectly during this evaluation
- This could cause `rwsdk/client` to resolve to the wrong export (one that requires `react-server` condition)

### Why Our Esbuild Plugin Isn't Working

The SSR environment optimization is likely happening:
1. **During worker entry execution** - When SSR code is imported as a side effect of running the worker entry
2. **Before our plugins are fully applied** - Or SSR environment optimization uses a different code path that doesn't use our esbuild plugins
3. **Independently from worker optimization** - SSR environment may have its own optimizer instance that doesn't inherit our plugin configuration

### Next Investigation Steps

1. Verify if SSR environment's `depsOptimizer.init()` is called separately during worker entry execution
2. Check if our esbuild plugins are applied to SSR environment's optimizer configuration
3. Investigate if SSR optimization happens synchronously during worker entry execution, before our plugins can intercept
4. Consider if we need to set up our plugins differently for SSR environment, or if SSR optimization needs to be deferred

## Solution: Explicit SSR Optimizer Initialization

After investigating Vite's dependency optimization flow, the root cause became clear: SSR code execution happens **before** SSR's `depsOptimizer.init()` runs, causing `react-dom/server.edge` to be discovered lazily instead of being pre-processed from `optimizeDeps.include`.

### Vite's Normal Dependency Discovery Flow

From Vite's `optimizer.ts` code (lines 164-235), the normal flow is:

1. **`init()` is called** (typically during `environment.listen()`)
2. **`addManuallyIncludedOptimizeDeps()` runs first** (line 173) - processes `optimizeDeps.include` synchronously
3. **Deps added to `metadata.discovered`** (lines 181-187) - `react-dom/server.edge` is added immediately
4. **Scanner runs in background** (line 197) - `discoverProjectDependencies()` runs asynchronously
5. **Scanner filters out already-discovered deps** (lines 221-226) - avoids duplicates
6. **When code executes** - `registerMissingImport()` checks `metadata.discovered` first (line 567)
7. **If found in `discovered`** - returns early (lines 568-571), no "new dependency" message

### What Changed with Cloudflare Plugin 1.15.0

**Previously (before 1.15.0):**
- SSR code executed **after** `environment.listen()` ran
- By then, `init()` had already run → `optimizeDeps.include` processed → `react-dom/server.edge` in `metadata.discovered`
- When SSR code imported it, `registerMissingImport()` found it in `discovered` → no "new dependency"

**Now (with 1.15.0's `ctx.exports` support):**
- SSR code executes **during `configureServer`** (when fetching worker export types via `getWorkerEntryExportTypes()`)
- This happens **before** `environment.listen()` → `init()` hasn't run yet
- `optimizeDeps.include` not processed → `react-dom/server.edge` **not** in `metadata.discovered`
- When SSR code imports it, `registerMissingImport()` doesn't find it → adds as "new dependency" via `addMissingDep()`
- Later, `init()` runs and processes `optimizeDeps.include`, but it's too late - already marked as "new"

### The Fix

Added explicit `depsOptimizer.init()` call in `knownDepsResolverPlugin.configureServer()` with `enforce: "pre"` to ensure it runs **before** the Cloudflare plugin's `configureServer` hook:

```typescript
async configureServer(server) {
  // Initialize SSR optimizer before SSR code executes (which happens during
  // Cloudflare plugin's configureServer when fetching worker export types).
  // This ensures optimizeDeps.include dependencies are added to metadata.discovered
  // before lazy discovery via registerMissingImport happens, preventing "new
  // dependencies optimized" messages for dependencies already in optimizeDeps.include.
  if (server.environments.ssr?.depsOptimizer) {
    await server.environments.ssr.depsOptimizer.init();
  }
}
```

### Why This Works

By explicitly calling `init()` in `configureServer` (with `enforce: "pre"`) **before** the CF plugin runs:

1. **`optimizeDeps.include` gets processed first** → `react-dom/server.edge` added to `metadata.discovered`
2. **Cloudflare plugin's `configureServer` runs** → worker entry executes → SSR code imports `react-dom/server.edge`
3. **`registerMissingImport()` checks `metadata.discovered`** (line 567) → **found** → returns early (lines 568-571)
4. **No "new dependency" path** → no "new dependencies optimized" message → no React version mismatch

### Key Insight

The issue isn't that `optimizeDeps.include` doesn't work - it's that **SSR code execution happens earlier** (during `configureServer`) than Vite's normal dependency discovery flow expects. The normal flow assumes code executes **after** `environment.listen()` has called `init()`, but Cloudflare plugin 1.15.0's export type detection breaks this assumption by executing code during `configureServer`.

The fix ensures `optimizeDeps.include` is processed **before** any SSR code executes, restoring the expected order: `optimizeDeps.include` → `metadata.discovered` → code execution → `registerMissingImport()` finds it → no "new dependency".

## Cross-Request Promise Resolution Warning

After fixing the React version mismatch, a warning appeared:

```
Warning: A promise was resolved or rejected from a different request context than the one it was created in. However, the creating request has already been completed or canceled. Continuations for that request are unlikely to run safely and have been canceled.
```

### Root Cause

The warning was caused by unused code: `waitForRequestInfo()` and `requestInfoDeferred`. This code was never imported or called anywhere in the codebase, but `runWithRequestInfo()` was still resolving `requestInfoDeferred` on every request.

**The problem:**
1. During Cloudflare plugin's export type detection (fake request context during `configureServer`), `runWithRequestInfo()` was called
2. It resolved `requestInfoDeferred` (a global promise resolver)
3. Later, during a real HTTP request, `runWithRequestInfo()` resolved the same deferred again
4. Cloudflare Workers detected the cross-request promise resolution and warned

### Solution

Removed the unused code:
- `requestInfoDeferred` - global promise resolver that was never awaited
- `waitForRequestInfo()` - function that was never imported or called
- `requestInfoDeferred.resolve()` call in `runWithRequestInfo()` - resolving a promise no one was waiting for

`runWithRequestInfo()` now runs the function directly in the AsyncLocalStorage context, which is all that's needed. Since no code was waiting for the promise, removing it eliminates the warning without affecting functionality.

---

## PR Title

fix(dev): Proactive directive scanning to prevent deadlock with Cloudflare Vite plugin 1.15.0

## PR Description

### Problem

After upgrading to `@cloudflare/vite-plugin@1.15.0`, the dev server would hang during startup. The Cloudflare plugin's `ctx.exports` feature runs the worker entry module during `configureServer` to detect exports, which triggers SSR code evaluation before SSR's dependency optimizer initializes. This caused:

1. **Deadlock:** Our directive scan blocked Vite's dependency optimizer, which the Cloudflare plugin was waiting for, creating a circular dependency.
2. **React version mismatch:** SSR dependencies were discovered lazily instead of being pre-processed from `optimizeDeps.include`, causing version conflicts.
3. **Cross-request promise warning:** Unused promise resolution code triggered Cloudflare Workers warnings.

### Solution

**Proactive directive scanning:** Run the directive scan before Vite's lifecycle hooks begin using `vite.resolveConfig()`. This ensures the scan completes before any plugins execute, eliminating timing dependencies and compatibility concerns.

**SSR optimizer initialization:** Explicitly initialize SSR's dependency optimizer in `configureServer` (with `enforce: "pre"`) before the Cloudflare plugin runs, ensuring `optimizeDeps.include` dependencies are processed before SSR code executes.

**Code cleanup:** Removed unused `requestInfoDeferred` promise resolution code that was causing cross-request warnings.

### Changes

- Made `redwoodPlugin()` async and added proactive `resolveConfig()` call before returning plugins
- Moved directive scan to run during proactive config resolution
- Removed blocking logic from `directiveModulesDevPlugin` (no longer needed)
- Added SSR optimizer initialization in `knownDepsResolverPlugin.configureServer()`
- Fixed slugification handling in esbuild resolver plugin (`.` → `__` conversion)
- Fixed entry point resolution (removed `importer !== ""` check)
- Changed `knownDepsResolverPlugin` to `enforce: "pre"` for earlier execution
- Updated `runDirectivesScan` to accept `ResolvedConfig["environments"]` type
- Removed unused `requestInfoDeferred` and `waitForRequestInfo()` code

### Testing

- Dev server starts successfully without hanging
- No React version mismatch errors
- No cross-request promise resolution warnings
- Compatible with Cloudflare Vite plugin 1.15.0 and older versions

