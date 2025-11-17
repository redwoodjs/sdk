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

The core challenge was to propagate the resolution result (specifically, the `external` status) from the `ssr` environment to the `worker` environment. Our approach evolved through several attempts.

1.  **Incorrect API (`.resolver.resolve`):** Our first attempt was to query the `ssr` environment's resolver directly from our `resolveId` hook using `devServer.environments.ssr.resolver.resolve()`. This failed with a TypeScript error, as `resolver` is not a public property on the `DevEnvironment` class.

2.  **Correct but Problematic API (`.pluginContainer.resolveId`):** We corrected this to use the public API, `devServer.environments.ssr.pluginContainer.resolveId()`. While this was technically correct, it introduced a new runtime error: "Method Not Allowed". This indicated that invoking the plugin container of another environment during resolution had unintended side effects within Vite's dev server.

3.  **Final Solution (Static List):** Given the instability of the dynamic approach, we switched to a more direct and safer solution. We leveraged the existing, predefined list of external modules in `constants.mts`.
    - We created and exported an `externalModulesSet` for efficient lookups.
    - In the `ssrBridgePlugin`'s `resolveId` hook, we replaced the dynamic, cross-environment call with a simple check: `if (externalModulesSet.has(realId))`.
    - If the module ID is in the set, the plugin immediately returns `{ id: realId, external: true }`.

This final approach is more surgical and robust. It avoids the complexities and side effects of cross-environment calls during resolution and explicitly handles the known set of modules that need to be externalized.

## 2025-11-17 Part 2: A Deeper Misunderstanding

The static list approach also failed, returning the same error. This indicates a more fundamental issue. My current hypothesis is that our `ssrBridgePlugin` is interfering with or bypassing the Cloudflare plugin's own mechanisms for handling these special `cloudflare:` modules.

When our `load` hook fetches a module like `capnweb.js` from the `ssr` environment and then rewrites its imports, we are effectively taking control of its dependency resolution. Even though we correctly rewrite `cloudflare:workers` to be a direct import, the context is lost. The request is now coming from our plugin's virtualized world, and it seems Vite's module runner doesn't know how to route that request back to the Cloudflare plugin for proper handling.

The next step is to stop guessing and investigate precisely what the Cloudflare plugin does. We need to understand its `resolveId` and `load` hooks to see how it identifies and serves these special modules. Only then can we figure out how to make our bridge compatible with it, rather than fighting it.

## 2025-11-17 Part 3: The Missing Piece

The investigation into the `vite-plugin-cloudflare` source code revealed the critical piece of information. The plugin does **not** have a special `resolveId` hook to handle modules like `cloudflare:workers`. Instead, in `plugins/virtual-modules.ts`, one of its own virtual modules simply contains a standard, bare import: `import { ... } from "cloudflare:workers"`.

This means the Cloudflare plugin relies on Vite's default behavior for SSR environments, where bare module specifiers that are not found in `node_modules` are treated as external.

Our mistake was in the `ssrBridgePlugin`'s `load` hook. When we processed the code coming from the `ssr` environment, our logic would rewrite an import for `cloudflare:workers` into `import("/@id/cloudflare:workers")` (or a variation with our virtual prefix). The `/@id/` prefix is a signal to Vite to treat the import as an internal module that it must resolve and load. This broke the default externalization behavior that the Cloudflare plugin depends on.

You were right that we were on the right track by trying to avoid prefixing, but we were incomplete. The correct, minimal solution is to modify the import rewriting logic to check if an import specifier is one of our known external modules. If it is, we must leave it completely untouched, preserving it as a bare specifier. This allows Vite's default externalization to work as the Cloudflare plugin expects.
