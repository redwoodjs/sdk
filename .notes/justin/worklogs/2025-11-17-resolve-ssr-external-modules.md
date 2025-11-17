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

## 2025-11-17 Part 4: Full Circle and the Real Culprit

After all the previous attempts, the error still persisted. This forced a re-examination of our core assumptions and a deeper look at the Vite `ModuleRunner`'s source code (`packages/vite/src/module-runner/runner.ts`).

The insight we were missing is simple and fundamental: the decision to use `runExternalModule` vs. `runInlinedModule` depends *entirely* on the result of the `fetchModule` transport call. Specifically, the `directRequest` method inside the `ModuleRunner` checks for one thing: `if ('externalize' in fetchResult)`.

This is the root of our problem. Our `ssrBridgePlugin`'s `load` hook, in its effort to serve modules from the `ssr` environment, has been acting as a man-in-the-middle. It calls `devServer.environments.ssr.fetchModule()`, gets the code, transforms it, and then returns it. The critical flaw is that when the `ssr` environment's `fetchModule` resolves an external module like `cloudflare:workers`, it returns a result that signals it is external. Our `load` hook, however, is only designed to handle results that contain `code`. It doesn't recognize or preserve the "external" signal.

So, the `worker` environment's module runner never sees the `externalize` property it needs. All our attempts to fix this in `resolveId` were misguided because `resolveId` only determines the module's ID; it doesn't provide the final fetch result that the runner inspects.

The solution must be in the `load` hook. We need to:
1.  Call `devServer.environments.ssr.fetchModule()`.
2.  Inspect the result.
3.  If the result from the `ssr` environment indicates the module is external (i.e., it has the `externalize` property), we must stop and find a way to propagate this information. Returning `null` or an empty object from `load` should trigger Vite to re-run resolution, hopefully now with the correct context.

## 2025-11-17 Part 5: The Diagnostic Logs and the Real Root Cause

After adding diagnostic logs directly into the Cloudflare `ModuleRunner`'s distributed code, the evidence became undeniable. The logs showed the `fetchModule` call for `cloudflare:workers` was returning a result *without* the `externalize` property. This was the smoking gun.

However, a closer look at the logs revealed the true culprit, which we had missed. The `url` being requested was not `cloudflare:workers` but `/@id/cloudflare:workers`. This `/@id/` prefix, added automatically by Vite's dev server to handle bare imports, was the root of all the cascading failures. It caused our `externalModulesSet.has(id)` check in `resolveId` to fail and, more importantly, caused the `ModuleRunner`'s internal `isBuiltin` check to fail because it was not designed to handle prefixed paths.

This led to a frustrating and extended detour to solve what appeared to be a separate issue.

### The React Mismatch Detour

While investigating, we ran into a new, seemingly unrelated error: a React version mismatch between the `rwsdk` and the `use-synced-state` playground. `pnpm ls` confirmed two different canary versions were active. This happened because the playground had an explicit, newer version in its `package.json`, while the linked `rwsdk` was resolving its peer dependency against an older version recorded in the monorepo root's lockfile.

We attempted several fixes:
1.  **`pnpm.overrides`:** Added overrides to the root `package.json` to enforce a single version.
2.  **SDK `devDependencies`:** Added matching React versions to the SDK's `devDependencies`.
3.  **Renovate Config:** Updated `renovate.json` to keep these new `devDependencies` in sync.

While these were technically correct solutions for forcing version alignment, they were merely treating a symptom.

### The True Culprit Unveiled

The React mismatch was not the disease, but a symptom of a deeper problem. The SSR environment was optimizing `react-dom/client`, which should never happen. We traced the import chain and found the cause in `sdk/src/use-synced-state/useSyncedState.ts`:

```typescript
import { React } from "../runtime/client/client.js";
```

This relative import was pulling the SDK's entire client-side entry point into any module that used `useSyncedState`. Because this was happening in the SSR context, it incorrectly pulled client-only dependencies like `react-dom/client` into the SSR dependency graph. This relative path also completely bypassed our `knownDepsResolverPlugin`, which is designed to handle bare specifiers like `"react"`, causing the version mismatch that sent us on the long detour.

### The Final, Correct Solution

Once we identified the faulty import, the solution path became clear:

1.  **Fix the Isomorphic Path:** The import in `useSyncedState.ts` was changed to a standard, direct import: `import React from "react";`. This immediately stopped the client-side code from leaking into the SSR environment, which fixed the `react-dom/client` optimization issue and, by extension, the React version mismatch. All the workarounds (`overrides`, `devDependencies`, `renovate` changes) were no longer necessary and were reverted.

2.  **Revisit the Original Problem:** With all other noise eliminated, we could finally solve the `cloudflare:workers` issue. The core problem was that our `ssrBridgePlugin`'s `load` hook was indiscriminately rewriting all import specifiers found in modules fetched from the `ssr` environment. It would take a bare import like `cloudflare:workers` and transform it into `import("/@id/virtual:rwsdk:ssr:cloudflare:workers")`. This broke the `worker` environment's ability to recognize it as a platform-native module that should be externalized.

The final solution was a single, targeted change within the `load` hook. Before rewriting an import, we now check if the specifier is a known external module. If it is, we preserve it as a bare specifier (e.g., `import("cloudflare:workers")`); otherwise, we apply our virtual prefix. This single change ensures external modules are handled correctly without needing any corresponding logic in the `resolveId` hook.
