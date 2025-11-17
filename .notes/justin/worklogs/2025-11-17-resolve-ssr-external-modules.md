# Work Log: 2025-11-17 - Resolve SSR External Modules

## Problem

When running an application in development, a server-side render (SSR) fails if a dependency attempts to import a platform-specific module like `cloudflare:workers`. The Vite dev server throws an error: `Failed to load url cloudflare:workers`.

This occurs within the `worker` environment's module runner, which is provided by Cloudflare's Vite plugin. The runner attempts to execute the module's code inline (`runInlinedModule`) instead of treating it as an external dependency (`runExternalModule`), which is the correct path for platform-native modules. This indicates a breakdown in how module metadata is communicated between our `ssr` and `worker` Vite environments.

## Investigation and Findings

1.  **Module Runner Logic:** We first examined the Cloudflare Vite plugin's custom `ModuleRunner`. It contains distinct logic paths: `runInlinedModule` for standard code and `runExternalModule` for external dependencies, including a specific check for `cloudflare:workers`. The error confirmed we were incorrectly entering the `runInlinedModule` path.

2.  **Vite Internals:** To understand why, we investigated Vite's own `ModuleRunner` source code. The decision point is in the `directRequest` method. It checks for an `externalize` property on the module's metadata (`mod.meta`), which is the result of a `fetchModule` call from Vite's plugin container.
    - If `externalize` exists, Vite calls `runExternalModule`.
    - If it does not exist, Vite proceeds with the inlined execution path.

3.  **The SSR Bridge:** This discovery pointed to an issue in our `ssrBridgePlugin`. The plugin's `load` hook was responsible for fetching module code from the `ssr` environment and returning it to the `worker` environment. However, the `load` hook's API (`LoadResult`) is only designed to return code and sourcemaps; it has no mechanism to signal that a module should be treated as external. The "external" status, determined correctly in the `ssr` environment, was being lost when crossing the bridge.

## Hurdles and Solution

The core challenge was to propagate the resolution result (specifically, the `external` status) from the `ssr` environment to the `worker` environment.

1.  **Incorrect API Usage:** Our first attempt was to query the `ssr` environment's resolver directly from our `resolveId` hook using `devServer.environments.ssr.resolver.resolve()`. This failed with a TypeScript error, as you correctly pointed out, because `resolver` is not a public property on the `DevEnvironment` class.

2.  **The Correct API:** The proper way to programmatically invoke an environment's plugin chain is through its `pluginContainer`. The correct method is `devServer.environments.ssr.pluginContainer.resolveId()`.

3.  **Final Solution:** We implemented the solution in the `ssrBridgePlugin`'s `resolveId` hook.
    - When the hook encounters a virtual SSR module (`virtual:rwsdk:ssr:...`) in the `worker` environment, it first asks the `ssr` environment's `pluginContainer` to resolve the *real* module ID.
    - It checks the result. If the `ssr` environment's resolution returns an object with `external: true`, our `resolveId` hook immediately returns this result to the `worker` environment.
    - This ensures the `worker` environment's module runner gets the correct metadata *before* the `load` hook is ever involved, allowing it to correctly identify the module as external and use the appropriate `runExternalModule` logic.
    - This entire process is wrapped in a `try...catch` block to prevent any unexpected errors in the `ssr` resolution from crashing the server, falling back to the original behavior if needed.
