# Mantine Playground - React Server Condition Race Condition

## Problem

Intermittent failure in CI for the Mantine playground example with error:

```
Error: rwsdk: 'react-server' is not supported in this environment
```

The error occurs during dev server startup, specifically when the SSR bridge (`rwsdk/__ssr_bridge`) is being processed. The issue is timing-dependent and appears more frequently with larger libraries like Mantine.

## Investigation

### Error Pattern

From the logs, the error occurs when:
1. `rwsdk/__ssr_bridge` is being evaluated
2. The module resolution hits `package.json` exports with `"react-server"` condition
3. Our error handler throws because `react-server` is not supported in the worker environment

### Key Observations

1. **Intermittent behavior**: The error happens sometimes but not always, indicating a race condition
2. **Mantine-specific**: The issue appears more frequently with Mantine (large library), suggesting timing is more critical with larger dependency graphs
3. **SSR bridge resolution**: The SSR bridge should be handled by special case logic in `knownDepsResolverPlugin`'s esbuild plugin, but sometimes it's not being intercepted

### Expected Behavior

The SSR bridge (`rwsdk/__ssr_bridge`) should be handled by the esbuild plugin in `ssrBridgePlugin` (lines 101-110), which marks it as `external: true`. This prevents esbuild from bundling it and should prevent it from being resolved through normal package.json exports.

The race condition occurs when the esbuild plugin's `onResolve` hook doesn't intercept `rwsdk/__ssr_bridge` before normal module resolution proceeds. When normal resolution happens, it hits `package.json` exports which has:

```json
"./__ssr_bridge": {
  "react-server": "./dist/runtime/entries/no-react-server.js",
  ...
}
```

The `"react-server"` condition matches (incorrectly for worker environment), and the `no-react-server.js` file throws an error.

### What's Happening

When the race condition occurs:
1. Dependency optimization starts processing modules
2. `rwsdk/__ssr_bridge` is encountered as a dependency
3. The esbuild plugin's `onResolve` hook doesn't intercept it in time (or at all)
4. Normal module resolution proceeds, hitting `package.json` exports
5. The `"react-server"` condition matches (incorrectly for worker environment)
6. Our error handler throws

### Why It's Intermittent

The race condition likely occurs because:
- Dependency optimization processes modules in parallel
- The esbuild plugin hook may not be registered/ready when the module is first encountered
- With larger libraries (like Mantine), more modules are processed, increasing the chance of timing issues
- The order of module processing can vary between runs

### Stack Trace Analysis

From the logs:
- The error occurs during `runInlinedModule` for `rwsdk/__ssr_bridge`
- The worker entry point (`rwsdk/worker`) imports the bridge
- The bridge is being resolved through package.json exports instead of the esbuild plugin

### Potential Root Causes

1. **Plugin registration timing**: The esbuild plugin may not be fully registered when dependency optimization starts processing modules
2. **Hook execution order**: The `onResolve` hook may not be executing before normal module resolution
3. **Enforce order**: Even though `knownDepsResolverPlugin` has `enforce: 'pre'`, the esbuild plugin hooks may not be guaranteed to run first
4. **Dependency optimization timing**: The optimizer may start processing before all plugins are fully initialized

### Code Analysis

Looking at the code:

1. **`ssrBridgePlugin`** (lines 87-113): Adds an esbuild plugin that marks `rwsdk/__ssr_bridge` as external (lines 101-110). This should intercept the module before normal resolution.

2. **`configPlugin`** (line 55): Includes `rwsdk/__ssr_bridge` in `optimizeDeps.include`, which means it's explicitly requested for optimization.

3. **`package.json`** (line 48-52): Has exports for `./__ssr_bridge` with `"react-server"` condition pointing to `no-react-server.js`, which throws an error.

The race condition occurs because:
- The esbuild plugin in `ssrBridgePlugin` should intercept `rwsdk/__ssr_bridge` before normal resolution
- Sometimes the plugin hook doesn't run in time (especially with larger libraries processing more modules in parallel)
- When normal resolution proceeds, it hits `package.json` exports
- The `"react-server"` condition matches incorrectly, leading to `no-react-server.js` being loaded

### Solution

Update `no-react-server.ts` to provide a clearer error message that explains this is a bug and should be reported, rather than just saying "react-server is not supported". This helps identify when the race condition occurs and makes it clear this is a bug rather than expected behavior.

### Hook Ordering Investigation

From Vite's source code (`packages/vite/src/node/config.ts` and `packages/vite/src/node/server/index.ts`):

1. **`configEnvironment` hook** (line 1243): Runs during config resolution, before config is fully resolved
2. **`configResolved` hook** (line 1645): Runs after config is resolved but before server creation
3. **`_createServer`** is called
4. **`configureServer` hook** (line 911): Runs during server creation

**Order:** `configEnvironment` → `configResolved` → `configureServer`

### Root Cause Theory

The issue is that `ssrBridgePlugin` uses `configEnvironment` to set up the esbuild plugin. However, when Cloudflare plugin v1.15.0 dispatches a request during `configureServer`, dependency optimization may start processing modules before `configEnvironment` hooks have fully completed or before the esbuild plugin array is finalized.

The theory is that:
- `configEnvironment` runs during config resolution, where environment configs are still being merged
- Something may be overwriting or resetting the `optimizeDeps.esbuildOptions.plugins` array after `configEnvironment` runs
- Or the plugin array isn't finalized until later in the resolution process

### Solution: Use `configResolved` Instead

Following the pattern used by `knownDepsResolverPlugin`, we should use `configResolved` instead of `configEnvironment`:

- `configResolved` runs after the config is fully resolved, directly mutating the resolved config object
- This ensures the esbuild plugin is set up on the final config object that will be used
- It runs before `configureServer`, so it's still early enough
- It's more reliable because it directly mutates the resolved config rather than modifying it during resolution

### Implementation

Changed `ssrBridgePlugin` to use `configResolved` instead of `configEnvironment`, directly mutating `config.environments.worker.optimizeDeps.esbuildOptions.plugins` like `knownDepsResolverPlugin` does.

### Next Steps

1. Test if this fixes the race condition
2. Monitor logs to confirm the esbuild plugin setup hook is consistently called
3. If issues persist, investigate further or consider alternative approaches

### Reverting `configResolved` Change

Moving the esbuild plugin setup from `configEnvironment` to `configResolved` did not fix the issue. The change was reverted.

### Module Graph Caching Hypothesis

Further investigation suggests the issue might not be about the esbuild plugin hook running or not, but rather about Vite's module graph caching behavior.

#### Finding: `resolveId` Hook May Be Bypassed

It appears that when Vite's `transformRequest` function processes a module, it first checks if the module already exists in the `moduleGraph` via `environment.moduleGraph.getModuleByUrl(url)`. If a `ModuleNode` exists in the graph, Vite might skip the entire `pluginContainer.resolveId` pipeline and directly use the cached `module.id` from the existing `ModuleNode`.

#### Success Case vs Failure Case Observations

**Success case** (from logs):
- Line 2134: `resolveId` hook runs: "Bridge module case (dev): id=rwsdk/__ssr_bridge matches rwsdk/__ssr_bridge in worker environment, returning virtual id=virtual:rwsdk:ssr:rwsdk/__ssr_bridge"
- Module runner uses virtual ID: `/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge`
- Works correctly

**Failure case** (from logs):
- No "Bridge module case" log - `resolveId` hook doesn't appear to run
- Module runner tries to use cached optimized dep directly: `/node_modules/.vite/deps_worker/rwsdk___ssr_bridge.js?v=df8d5e57`
- This cached file seems to contain the error code, possibly because when it was optimized, our esbuild plugin didn't run (cache existed), so it wasn't marked external and got bundled with the `react-server` condition code

#### Hypothesis: Module Graph Caching Causes Intermittent Behavior

The intermittent behavior might occur because:

1. **When the module is NOT in the graph**: `transformRequest` calls `pluginContainer.resolveId`, our `ssrBridgePlugin` intercepts `rwsdk/__ssr_bridge`, returns virtual ID, works correctly.

2. **When the module IS in the graph**: `transformRequest` might skip `pluginContainer.resolveId` entirely, using the cached `module.id` from the existing `ModuleNode`. If this `ModuleNode` was created from a previous resolution that incorrectly resolved `rwsdk/__ssr_bridge` to `rwsdk___ssr_bridge.js` (the optimized dep file containing the error), then the error would occur.

#### Why This Might Not Have Been an Issue Before

Before Cloudflare plugin v1.15.0:
- The worker entry wasn't executed during `configureServer`
- `rwsdk/__ssr_bridge` wasn't resolved during server startup
- It was only resolved later when actual requests came in, after everything was initialized
- The module graph might have been cleaner/empty at that point

After Cloudflare plugin v1.15.0:
- The worker entry is executed during `configureServer` to detect exports
- This triggers early resolution of `rwsdk/__ssr_bridge` during startup
- If a stale `ModuleNode` exists in the graph (from a previous optimization run where our esbuild plugin didn't run), it might get reused
- This could bypass our `resolveId` hook

#### Why It Might Be Intermittent

The module may or may not be in the graph depending on:
- Whether it was resolved earlier in the same request chain
- Whether it was resolved in a previous request/optimization run
- Whether the `.vite` cache exists (which contains the optimized `rwsdk___ssr_bridge.js` file)
- The order of module processing during dependency optimization

#### Key Insight: Modules Must Go Through `resolveId` At Least Once

If a module is in the graph, it must have gone through `resolveId` at least once. This means:
- The stale `ModuleNode` with the wrong `id` was created during a previous `resolveId` call
- Our hook either didn't run, or ran but didn't intercept `rwsdk/__ssr_bridge` correctly

Possible scenarios:
1. **Our hook ran but returned `undefined`/`null`**: Unlikely, as our hook should return a virtual ID for `rwsdk/__ssr_bridge` in the worker environment
2. **Another plugin ran before ours and returned a result**: We use `enforce: 'pre'`, but `preAliasPlugin` runs before user plugins. However, `preAliasPlugin` only handles alias patterns, and `rwsdk/__ssr_bridge` probably doesn't match any
3. **The module was resolved in a different environment**: Our hook only intercepts `rwsdk/__ssr_bridge` in the `worker` environment (line 166). If it was resolved in SSR or client first, our hook wouldn't run
4. **The module was resolved during dependency optimization**: If `rwsdk/__ssr_bridge` is discovered as a dependency during optimization, it goes through `resolveId` during the scan phase. Our hook should run, but maybe something else intercepted it first

#### Root Cause Discovery: Directive Scanning Skip

After adding logging to track when `resolveId` is called for `rwsdk/__ssr_bridge`, we discovered that the "AFTER directive scanning" log never appears for `rwsdk/__ssr_bridge` in failure cases. This means the hook is returning early at the `RWSDK_DIRECTIVE_SCAN_ACTIVE` check (line 137).

**The Problem:**

1. Cloudflare plugin v1.15.0 dispatches a request during `configureServer` to detect exports
2. This triggers dependency optimization, which resolves `rwsdk/__ssr_bridge` as part of processing the worker entry
3. Our directive scanning runs in `configureServer` with `enforce: 'pre'`, so it's still active when Cloudflare's early dispatch happens
4. When `resolveId` is called for `rwsdk/__ssr_bridge` during directive scanning, we return `undefined` (line 137) because of the `RWSDK_DIRECTIVE_SCAN_ACTIVE` check
5. Returning `undefined` allows Vite to continue with normal module resolution, which matches the `react-server` condition from `package.json` exports
6. This creates a race condition - sometimes directive scanning finishes before Cloudflare's early dispatch, sometimes it doesn't

**Why This Is Intermittent:**

The race condition occurs because:
- Directive scanning duration varies based on project size
- Cloudflare's early dispatch timing may vary slightly
- Sometimes directive scanning finishes before `rwsdk/__ssr_bridge` is resolved, sometimes it doesn't

**The Fix:**

We should NOT skip `rwsdk/__ssr_bridge` during directive scanning. We should always intercept it, even during scanning. The directive scanning skip was added to avoid performance issues, but `rwsdk/__ssr_bridge` is a critical module that must always be handled correctly, regardless of when it's resolved.

#### Final Solution: Custom Option Approach

Instead of special-casing `rwsdk/__ssr_bridge` in the directive scanning check, we implemented a more general solution that distinguishes between our directive scan and external calls.

**The Approach:**

1. **`createViteAwareResolver` always passes custom option**: Since `createViteAwareResolver` is only called from our directive scanning code (`runDirectivesScan.mts`), it always passes `custom: { rwsdk: { directiveScan: true } }` when calling plugin `resolveId` hooks.

2. **Plugins check custom option instead of env var**: All `resolveId` hooks now check `options.custom?.rwsdk?.directiveScan === true` instead of `process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE`. This allows them to:
   - Skip when called from our directive scan (performance)
   - Handle normally when called from external sources like Cloudflare's early dispatch (correctness)

3. **Env var still used for `transform`/`load` hooks**: These hooks are not called by our directive scanner (we use `esbuild` directly), but Vite may call them during normal processing (e.g., Cloudflare's early dispatch). The env var check remains for these hooks to skip during directive scanning for performance.

**Why This Works:**

- **No race condition**: External calls like Cloudflare's early dispatch don't have the custom option, so plugins handle them normally even if directive scanning is active
- **Performance maintained**: Our directive scan still skips plugin processing via the custom option
- **General solution**: Works for all plugins, not just `rwsdk/__ssr_bridge`

**Files Changed:**

- `createViteAwareResolver.mts`: Always passes `custom: { rwsdk: { directiveScan: true } }` when calling plugin hooks
- `ssrBridgePlugin.mts`: `resolveId` checks custom option instead of env var
- `knownDepsResolverPlugin.mts`: `resolveId` checks custom option instead of env var
- `createDirectiveLookupPlugin.mts`: `resolveId` checks custom option instead of env var
- `virtualPlugin.mts`: `resolveId` checks custom option instead of env var
- `runDirectivesScan.mts`: No longer sets/clears env var (not needed)

**Testing Results:**

After implementing the custom option approach, the race condition no longer appears in testing. Multiple attempts to reproduce the failure have been unsuccessful, suggesting the fix is working correctly.

**Potential Concerns:**

- **Caching for `resolveId` hooks**: If Vite caches `resolveId` results with the custom option, there might be edge cases. However, since our directive scan only calls `resolveId` (not `load`/`transform`), and external calls don't have the custom option, this should be fine.

- **`load`/`transform` hooks**: We removed the skip logic entirely for these hooks. Our directive scanner doesn't call them (uses `esbuild` directly), so they're only called by Vite's normal processing (e.g., Cloudflare's early dispatch). If we skip them during directive scanning, Vite might cache incorrect results from other plugins that ran instead. By processing them normally, we ensure correct results are cached regardless of when they're called.


**Status:**

The fix appears to be working. The race condition no longer reproduces in testing. We should continue monitoring CI and user reports to ensure the fix holds up under various conditions and project sizes.


## Pull Request

### Title

fix: race condition in SSR bridge resolution during dev server startup

### Description

**Problem**

We encountered an intermittent `Error: rwsdk: 'react-server' is not supported in this environment` failure in CI, particularly with larger libraries like Mantine.

Investigation revealed a race condition triggered by `@cloudflare/vite-plugin` v1.15.0. The plugin now dispatches a request to the worker entry during `configureServer` to detect exports. This dispatch occurs while our internal directive scanner is still running (which runs with `enforce: 'pre'`).

Previously, our plugins were configured to skip `resolveId`, `load`, and `transform` hooks when the `RWSDK_DIRECTIVE_SCAN_ACTIVE` environment variable was set, to improve scanning performance. However, because Cloudflare's early dispatch happens *during* this scan, our plugins were skipping resolution for critical modules like `rwsdk/__ssr_bridge`. This caused Vite to fall back to standard node resolution, which matched the `react-server` condition in `package.json`, loading a file designed to throw an error in the worker environment.

**Solution**

We have refactored how plugins distinguish between our internal directive scan and external requests:

1.  **Custom Option for `resolveId`**: Instead of a global environment variable, `createViteAwareResolver` (used by our scanner) now passes a custom option: `options.custom.rwsdk.directiveScan`.
2.  **Updated Plugins**: `resolveId` hooks in our plugins (`ssrBridgePlugin`, `knownDepsResolverPlugin`, etc.) now check this custom option. If present, they skip logic for performance. If absent (e.g., during Cloudflare's early dispatch), they proceed normally, ensuring `rwsdk/__ssr_bridge` is correctly resolved to its virtual ID.
3.  **Removed Skip for `load`/`transform`**: We removed the skip logic entirely for `load` and `transform` hooks. Since our directive scanner uses `esbuild` directly (bypassing Vite's plugin container for these steps), these hooks are only ever called by Vite's normal processing. Skipping them risked caching incorrect "undefined" results if triggered during the scan window.
4.  **Improved Error Messaging**: We separated the error file for `rwsdk/__ssr_bridge` to provide a specific error message indicating a resolution bug, distinguishing it from generic `react-server` condition mismatches.

This ensures that `rwsdk/__ssr_bridge` is always intercepted correctly, regardless of when the request occurs, while maintaining performance for our internal scans.
