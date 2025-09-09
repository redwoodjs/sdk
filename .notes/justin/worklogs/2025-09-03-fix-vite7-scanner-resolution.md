# Work Log: 2025-09-03 - Fixing Vite 7 Directive Scanner Resolution

## 1. Problem: Scanner Failure with Vite 7

Following a dependency update to Vite 7, the standalone `esbuild`-based directive scanner began to fail during startup. The scanner is critical for discovering `"use client"` and `"use server"` modules before Vite's main processing begins.

The build would crash with an `esbuild` error: `The entry point "/path/to/worker.tsx" cannot be marked as external`. Debugging revealed that our custom Vite-aware resolver was incorrectly resolving the `worker.tsx` entry point to `vite/modulepreload-polyfill.js`.

## 2. Investigation: Identifying the Culprit

The immediate goal was to identify which Vite plugin was causing the incorrect resolution. Our scanner works by iterating through all of a project's configured Vite plugins and calling their `resolveId` hooks.

1.  **Added Logging:** We injected `console.log` statements into the plugin processing loop within `createViteAwareResolver.mts`. This was set up to log the name of each plugin being called for `worker.tsx` and the result of its `resolveId` hook.
2.  **Immediate Discovery:** The logs immediately pinpointed the culprit. The output clearly showed:
    `###### Plugin 'vite:modulepreload-polyfill' resolved '.../worker.tsx' -> 'vite/modulepreload-polyfill.js'`

## 3. The Root Cause: Bypassing Vite 7's Plugin Filters

With the specific plugin identified, the next step was to understand *why* it was behaving this way. An inspection of the Vite 7 source code revealed a significant change in the plugin architecture.

-   **Vite 6 and earlier** used a simple function for the `resolveId` hook: `resolveId(id) { ... }`.
-   **Vite 7** introduced a new object-based structure to optimize plugin execution: `resolveId: { filter, handler }`. The `filter` is a declarative pattern (RegExp, string, etc.) that Vite uses to decide *whether* to execute the `handler` function.

The root cause was that our custom resolver, built for the older Vite architecture, was not aware of this new structure. It would check if `plugin.resolveId` was an object and, if so, would grab the `handler` function and execute it directly for every module. **This completely bypassed the `filter` check.**

The `vite:modulepreload-polyfill` plugin has a very specific filter (`{ id: /^vite\/modulepreload-polyfill$/ }`) and a handler that blindly returns the polyfill path, assuming the filter has already done its job. By bypassing the filter, we were incorrectly invoking its handler for `worker.tsx`, leading to the erroneous resolution.

## 4. The Solution: Implementing a Filter-Aware Resolver

Instead of a narrow fix to just skip the single problematic plugin, we implemented a robust, forward-compatible solution by making our resolver fully compliant with Vite 7's plugin system.

The `VitePluginResolverPlugin` was updated to:
1.  **Detect the Hook Format:** It checks if `resolveId` is a function (Vite 6 style) or an object (Vite 7 style).
2.  **Extract the Raw Filter:** If it's an object, it extracts the `filter` property.
3.  **Manually Apply the Filter:** Before calling the `handler`, it now manually applies the filter logic against the module ID.
4.  **Support All Filter Patterns:** The implementation correctly handles all of Vite's `StringFilter` types: RegExp, exact strings, arrays of patterns, and the `include`/`exclude` object pattern.

This change ensures that we respect the intended scope of every Vite plugin. The scanner now correctly skips the `modulepreload-polyfill` plugin for `worker.tsx` because the filter doesn't match, resolving the build failure. This solution is backward-compatible and ensures our scanner will work correctly with any current or future Vite 7+ plugins.
