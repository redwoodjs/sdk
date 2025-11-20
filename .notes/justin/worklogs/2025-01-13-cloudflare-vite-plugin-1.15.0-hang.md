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

## Experiment: Non-blocking Directive Scan

After implementing the proactive scanning architecture, we're testing a simpler alternative: removing the blocking `await scanPromise` calls in `directiveModulesDevPlugin.mts`.

### Hypothesis

The deadlock occurs because:
1. Cloudflare plugin triggers dependency optimization (via `depsOptimizer.init()`)
2. Dependency optimization hits our esbuild plugin's `onResolve` hook
3. The hook blocks on `await scanPromise`
4. The scan is running but can't complete because the main thread is blocked

If we remove the blocking, the optimizer should proceed immediately. The scan will run in the background and update barrel files when complete. Vite should handle the file updates via HMR or re-optimization.

### Changes Made

Restored files from `main` branch to get the original blocking implementation, then removed:
- `await scanPromise` in `build.onResolve` hook (line 162 in `directiveModulesDevPlugin.mts`)

The scan still runs in `configureServer`, but no longer blocks:
- Dependency optimization can proceed immediately (even with empty barrel files initially)
- Scan completes asynchronously and updates barrel files
- Vite should pick up changes when files are updated

### Expected Outcomes

**If successful:**
- Dev server starts without hanging
- Initial optimization may see empty barrel files, but should complete
- When scan finishes, barrel files update and Vite handles the change
- No deadlock, simpler code than proactive scanning

**If unsuccessful:**
- App may start with missing exports (if code imports from barrel files before scan completes)
- May need to add back blocking or use proactive scanning approach

### Testing Status

**First attempt:** Removed blocking `await` in `directiveModulesDevPlugin.mts`. Result: Still hangs.

**Revised Theory - Cloudflare Virtual Module Deadlock:**

After tracing through the Cloudflare plugin code, discovered that `getCurrentWorkerNameToExportTypesMap()` requests `virtual:cloudflare/export-types` during `configureServer`. This virtual module request triggers Vite's dependency optimizer to process it and its dependencies.

The deadlock sequence:
1. Cloudflare plugin's `configureServer` calls `getCurrentWorkerNameToExportTypesMap()`
2. This makes a request for `virtual:cloudflare/export-types`
3. Vite's dependency optimizer starts to process this virtual module
4. Optimizer hits our esbuild plugin → **BLOCKS** on `await scanPromise`
5. Cloudflare plugin is stuck waiting for the request to complete
6. Our scan (running in background) can't finish because optimizer is frozen
7. **DEADLOCK**

**The Fix - Skip Blocking for Cloudflare Virtual Modules:**

If `virtual:cloudflare/export-types` (or any Cloudflare virtual module) is being resolved through our esbuild plugin during optimization, we should skip the blocking `await scanPromise` for those specific modules. This allows Cloudflare's export type detection to proceed without waiting for our scan.

**Changes Made:**
- Added check in `build.onResolve` to detect Cloudflare virtual modules (`virtual:cloudflare/` or `\0virtual:cloudflare/`)
- Skip `await scanPromise` for these modules
- Added logging to verify this path is being hit during the hang

**Next Step:** Test if skipping the block for Cloudflare virtual modules resolves the hang. The logging will confirm whether this is the actual deadlock path.

**Second attempt:** The logs show the theory was incorrect. Our `onResolve` is being hit for the real worker entry (`src/worker.tsx`) before Cloudflare even makes its request. The block is happening earlier than anticipated.

The core facts remain:
1. We are blocking the Vite dependency optimizer when it first sees the worker entry.
2. The Cloudflare plugin is waiting for a `dispatchFetch` request to complete, which depends on the optimizer.

The unknown is why our directive scan, which is running in the background, never finishes to release the `scanPromise` lock. The next step is to add logging inside the scanner's own `esbuild` process to see what module resolution it's getting stuck on.

**Third attempt: `enforce: 'pre'`**

To test if the order of `configureServer` hooks matters, we're adding `enforce: 'pre'` to `directiveModulesDevPlugin`. This forces our `configureServer` to run before the Cloudflare plugin's hook.

**Hypothesis:** This will likely not fix the hang, as the fundamental deadlock (optimizer blocked by scan, which needs the optimizer) remains. However, it will prove that our hook is running first and allow us to see if that changes the behavior at all.

**Changes Made:**
- Added `enforce: 'pre'` to the `directiveModulesDevPlugin` definition.

**Next Step:** Run the dev server and observe the log output to confirm our `configureServer` runs before Cloudflare's and to see if the hang persists.

## Final Deadlock Analysis: The `configResolved` Trap

After extensive debugging, the true nature of the deadlock was identified. Our previous theories were close but missed a critical detail about Vite's plugin lifecycle. The key finding was that our `configureServer` hook in `directiveModulesDevPlugin` was **never being called** during the hang.

This revealed the real sequence of events:

1.  **`configResolved` Hook Runs Early:** Vite invokes the `configResolved` hook for all plugins. Our `directiveModulesDevPlugin` uses this hook to inject an `esbuild` plugin into the dependency optimizer. This `esbuild` plugin contains the blocking `await scanPromise;` logic. The trap is now set.

2.  **Optimizer is Triggered Before `configureServer`:** Before the `configureServer` hooks are ever called, something (likely the Cloudflare plugin's preparation for its `dispatchFetch` call) triggers Vite's dependency optimizer to start scanning for dependencies, beginning with the worker entry file (`src/worker.tsx`).

3.  **Optimizer Hits the Block:** The optimizer immediately encounters our `esbuild` plugin's `onResolve` hook and freezes, waiting for `scanPromise` to be resolved.

4.  **`configureServer` is Never Reached:** Because the dependency optimizer is a synchronous, blocking part of Vite's startup sequence, its freeze prevents Vite from ever proceeding to the `configureServer` stage.

5.  **Permanent Deadlock:** The `scanPromise` can only be resolved by the `runDirectivesScan` function, which is kicked off in our `configureServer` hook. Since `configureServer` is never called, the promise is never resolved, and the optimizer remains permanently blocked.

### The `enforce: 'pre'` Solution

The `enforce: 'pre'` fix works because it forces our `directiveModulesDevPlugin`'s `configureServer` hook to run before other plugins. This allows us to initiate the `runDirectivesScan` *before* the Cloudflare plugin has a chance to trigger the dependency optimizer. By the time the optimizer runs and hits our blocking `esbuild` plugin, the scan is already in progress and will eventually resolve the promise, breaking the deadlock.

## PR Title and Description

### Title

fix(vite): Resolve dev server hang and React version mismatch with Cloudflare Vite plugin v1.15.0

### Description

#### Problem

This change addresses two critical issues that arose after upgrading to `@cloudflare/vite-plugin@1.15.0`:

1.  A dev server hang during startup, preventing the server from becoming ready.
2.  An `Incompatible React versions` error, caused by incorrect dependency resolution during server startup.

#### Root Cause

The root cause of both issues is a new feature in the Cloudflare Vite plugin v1.15.0. To determine worker exports, the plugin now executes the worker entry file early in the dev server startup process (during the `configureServer` hook). This change in timing had two downstream effects on RedwoodSDK:

1.  **Deadlock with Directive Scanning:** The Cloudflare plugin's early execution created a deadlock due to an interaction between Vite's lifecycle hooks and our directive scanning process. The sequence is as follows:
    1.  During the `configResolved` hook, our `directiveModulesDevPlugin` injects an `esbuild` plugin into Vite's dependency optimizer. This plugin is configured to block (`await scanPromise`) until our directive scan is complete.
    2.  The Cloudflare plugin's `configureServer` hook runs. Inside this hook, it makes a request back to the dev server to determine worker exports and, critically, **blocks** by awaiting the result of this request.
    3.  This internal request indirectly triggers Vite's dependency optimizer to start processing the worker entry file.
    4.  The optimizer starts, immediately hits our blocking `esbuild` plugin, and freezes.
    5.  Because the optimizer is frozen, the Cloudflare plugin's request never completes, and because Vite's startup process is blocked waiting for the Cloudflare plugin's hook to finish, Vite never proceeds to the next stage.
    6.  Since our `configureServer` hook (the only place the directive scan is initiated) is never called - since it is blocked on Cloudflare plugin's configureServer completing, the `scanPromise` is never resolved, and the server is permanently deadlocked.

2.  **Broken Dependency Optimization Timing:** The early execution of the worker entry file also caused SSR code to be evaluated *before* Vite's SSR dependency optimizer had been initialized. This broke Vite's normal dependency discovery flow, causing modules listed in `optimizeDeps.include` (like `react-dom/server.edge`) to be treated as "new" dependencies instead of being recognized from the initial configuration. This led to the React version mismatch error.

#### Solution

The solution is a multi-part fix that addresses the new timing challenges and resolves several latent bugs that were exposed by this change:

1.  **Adjusted Plugin Execution Order:**
    -   To resolve the deadlock, we now ensure our critical plugins run before the Cloudflare plugin. Our plugin that scans the project for `"use client"` and `"use server"` directives now runs first, allowing it to begin its work before the dependency optimizer is triggered and blocked. Likewise, our plugin that aligns React versions across the app now runs earlier to prepare the environment.

2.  **Proactive Dependency Optimizer Initialization:**
    -   To fix the dependency timing issue, we now manually initialize Vite's SSR dependency optimizer at the start of the dev server setup. Our React version-alignment plugin now handles this, guaranteeing that Vite is aware of all critical dependencies (like `react-dom/server.edge`) *before* the Cloudflare plugin executes any code that might import them.

3.  **Improved Dependency Resolution Logic:**
    -   The early dependency scan surfaced several latent bugs in our React version-alignment plugin. We corrected flaws in how it identified Vite's pre-bundled modules and handled explicitly included dependencies. These fixes make our internal dependency resolution more robust.

4.  **Cleanup:**
    -   Removed unused code that was causing a "cross-request promise resolution" warning in Cloudflare Workers.
    -   Added extensive comments to our Vite plugins to document the rationale for their execution order, improving future maintainability.

## Regression: Content Collections Race Condition

A new regression has surfaced with the `@content-collections/vite` plugin. The dev server now fails with:

```
Error: RWSDK directive scan failed:
Error: Build failed with 1 error:
src/app/pages/Home.tsx:1:25: ERROR: Cannot read file ".content-collections/generated": is a directory
```

### Analysis

This is a timing conflict caused by our new `enforce: 'pre'` setting.

1.  **Our Scanner Runs First:** Because we moved `directiveModulesDevPlugin` to `enforce: 'pre'`, our directive scan (using `esbuild`) runs extremely early in the `configureServer` phase.
2.  **Content Collections Runs Later:** The `@content-collections/vite` plugin likely uses the default enforcement, meaning it runs after our scanner.
3.  **Fire-and-Forget Generation:** Even when the content collections plugin runs, its `configureServer` hook calls `builder.watch()` without awaiting it:
    ```javascript
    // node_modules/@content-collections/vite/dist/index.js
    async configureServer() {
      if (!builder) {
        return;
      }
      console.log("Start watching");
      builder.watch(); // Not awaited!
      return;
    }
    ```
4.  **The Race:** Our scanner's `esbuild` process attempts to resolve imports from `.content-collections/generated`. Since the content collections builder hasn't finished (or possibly even started) generating these files, `esbuild` fails to find the files or encounters a directory where it expects a file, leading to the error.

### Conclusion

We have exacerbated an existing race condition. Previously, our scanner ran later, likely giving content collections enough time to generate files "by accident." Now that we strictly enforce an early run to avoid the Cloudflare deadlock, we guarantee that we scan before generation is complete.

We need a synchronization mechanism to ensure that the content collections generation is finished (or at least that the files exist) before our directive scanner attempts to resolve them. Since `builder.watch()` is fire-and-forget, we can't simply await the plugin's hook. We may need to watch for file existence or find another signal.
