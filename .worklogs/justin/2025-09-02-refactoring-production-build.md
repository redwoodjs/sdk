# Work Log: 2025-09-02 - Refactoring the Production Build Process

## 1. Initial State & Problem Definition

The production build process was originally designed as a four-phase sequential build to solve a series of circular dependencies between the `worker`, `client`, and `ssr` Vite environments. The process was:

1.  **Worker Pass:** A partial worker build runs to discover client entry points and `"use client"` components.
2.  **Client Build:** Uses information from the worker pass to build the client assets.
3.  **SSR Build:** Also uses information from the worker pass to build server-side rendered components.
4.  **Linker Pass:** A final pass assembles the artifacts from all previous passes into a deployable `worker.js`.

The critical flaw in this design is that the `ssr` artifacts are generated in a separate environment but only bundled into the final output during the `linker` phase. The `linker` is a minimal environment and does not run the full suite of plugins that the `worker` environment does (specifically, the `@cloudflare/vite-plugin`).

As a result, the code from the `ssr` build is not processed with the necessary polyfills and transformations (e.g., for `nodejs_compat`) required to run in the Cloudflare Workers runtime. This leads to runtime errors in `vite preview` when the final, linked worker is executed.

## 2. Discarded Idea #1: A Scan-First, Sequential Build Process

To solve the linker transformation problem, we attempted to re-architect the build process to be more robust by eliminating the need for the linker to process untransformed SSR artifacts. The proposed sequential build process was:

1.  **Pre-Scan:** A standalone `esbuild` scan of the application source runs first, populating `clientFiles` and `serverFiles`.
2.  **SSR Build:** With the list of client components now available, the `ssr` build can run first.
3.  **Worker Build (with direct bundling):** The `worker` build runs next, bundling the SSR artifacts directly so they get the Cloudflare plugin transformations.
4.  **Client Build & Simplified Linker Build:** The final steps build client assets and link them.

### Why It Was Discarded: The Tree-Shaking Regression

This "scan-first" model introduced a subtle but critical regression. The original architecture (where the `worker` build ran first) had an important side-effect: Vite/Rollup's tree-shaking would naturally filter the list of all possible `"use client"` components down to only those that were *actually imported and used* in the application.

Our standalone `esbuild` scan was not a true substitute. It identified *every* file containing a `"use client"` directive anywhere in the dependency graph, not just the "entry" components used by our server code. This resulted in an enormous, unfiltered list of components being passed to the `ssr` build, defeating a critical optimization. We briefly attempted to use the `esbuild` metafile to perform tree-shaking, but this was also not a sufficiently accurate replacement for the real bundler's module graph analysis. The approach was abandoned.

## 3. The Definitive Solution: A "Two-Pass Worker" Build

We are returning to the original, `worker`-first build order, as it is the only way to get the accurate, tree-shaken list of client components. This brings us back to the original problem: how to ensure the `linker` pass gets the same transformations as the `worker` pass.

Our initial idea was to have the `linker` environment "inherit" the configuration from the `worker` environment. However, this approach is fundamentally flawed. Vite plugins are instantiated once at the root level. A new `linker` environment, even if created by spreading the `worker` config, would not correctly reuse the active plugin instances (like the Cloudflare plugin). The plugins would see an environment named "linker" and would not apply their necessary transformations.

The definitive solution is to eliminate the `linker` environment entirely and instead run the `worker` build twice.

1.  **Orchestration with an Environment Variable:** The `buildApp` function now orchestrates a two-pass process. It sets a `process.env.RWSDK_BUILD_PASS` variable to differentiate between the passes:
    *   `RWSDK_BUILD_PASS='worker'`: The first pass runs. It performs source code transformation, tree-shaking, and discovers client entry points.
    *   `RWSDK_BUILD_PASS='linker'`: The second pass runs.

2.  **In-Memory Reconfiguration:** Before the second pass, `buildApp` modifies the *existing, in-memory* worker environment configuration. It changes the `build.rollupOptions.input` to point to the intermediate worker artifact and the SSR bridge, effectively turning this second pass into our linker.

3.  **Pass-Aware Plugins:** All of our custom plugins (`ssrBridgePlugin`, `linkerPlugin`, `directivesFilteringPlugin`, etc.) have been updated with a simple conditional check. They now inspect `process.env.RWSDK_BUILD_PASS` and only execute their logic during the appropriate pass.

This "two-pass worker" strategy is the most robust solution. It guarantees that the final linking step runs within the *exact same*, fully-resolved `worker` environment, ensuring that all plugins—especially the critical Cloudflare plugin—are active and correctly transform the SSR artifacts before they are bundled.

## 4. Final State & Dev Server Fix

The "Two-Pass Worker" build is now fully implemented and working. However, the initial implementation of the "pass-aware" plugin logic introduced a regression that broke the development server.

The conditional check (e.g., `process.env.RWSDK_BUILD_PASS !== 'worker'`) was too broad. In dev mode, the `RWSDK_BUILD_PASS` variable is `undefined`, causing the check to incorrectly evaluate to `true` and disable critical plugins like the `directivesPlugin`.

The fix was to make the check more specific. We introduced an `isBuild` flag (set in the `configResolved` hook) to the plugins. The pass-aware logic is now only applied when `isBuild` is true, ensuring that the plugins run correctly and without interference in dev mode.

With this final fix, the refactoring is complete. The production build is robust, and the development server is fully functional.

## 5. Addendum: Smoke Test Refactoring for Build Compatibility

During the final testing of the refactored build system, we discovered that our existing smoke test infrastructure was incompatible with the new directive scanning process.

Previously, the tests worked by appending a `?__smoke_test=1` query parameter to any URL. Our SDK's worker runtime would detect this, dynamically import the `SmokeTest.tsx` component using `import.meta.glob`, and wrap the application's actual page component with our test component. This was clever, but its reliance on a dynamic, runtime import could not be statically analyzed by our new build-time directive scanner.

The smoke test framework has been refactored to be more explicit and robust. Instead of using a query parameter and a runtime wrapper, the test setup process now directly modifies the application's source code. It adds a static `import` for the `SmokeTest` component and injects a dedicated `/__smoke_test` route into the app's `defineApp` configuration in `worker.tsx`. This approach is less "magical" and follows the exact same code paths as any other component in the application, making the tests more realistic and compatible with our static analysis tooling.

## 6. Addendum: Diagnosing and Fixing Server Action State Loss

The newly refactored smoke tests immediately revealed a critical bug: in production builds, state updated by a server action was lost on the subsequent component re-render. The test would correctly see the action complete, but the UI would not reflect the new state. This did not happen in the dev server.

Analysis of the build artifacts showed that the `"use server"` module was being incorrectly split into a separate chunk (e.g., `assets/__smokeTestFunctions-....js`). This created a "split-brain" scenario:
1. The main `worker.js` loaded the module, with its state initialized.
2. The server action framework, when invoked, performed a dynamic `import()` on the separate chunk, loading a *second, temporary instance* of the module. The action updated the state in this temporary instance, which was then discarded.
3. The component re-render occurred in the context of the original `worker.js`, which still had the original, unmodified module instance.

The root cause was the `useServerLookupPlugin`. Our strategy to defer its execution until the final "linker" pass was correct in principle—we must wait for the `directivesFilteringPlugin` to run at the end of the first worker pass to get a tree-shaken list of actions. However, the implementation was flawed. It caused the lookup map to be regenerated with dynamic `import()`s during the final linker pass, which Rollup interpreted as code-splitting points.

The definitive solution is a more nuanced, environment-aware deferral strategy for the lookup plugins:
1.  **Worker Pass:** The lookup modules are marked as `{ external: true }`. This is the critical deferral step. It allows the `directivesFilteringPlugin` to run at the end of this pass and produce the final, tree-shaken list of client and server files *before* the lookup map is ever generated.
2.  **SSR Pass:** The lookup modules are *also* kept external. This ensures that both the worker and SSR artifacts refer to the same single source of truth for the lookup map, preventing duplication.
3.  **Client Pass:** The `useClientLookup` module is *not* externalized; it is resolved and bundled. The client needs its own version of the map based on the tree-shaken list of client components.
4.  **Linker Pass:** Finally, the `useServerLookup` and `useClientLookup` modules (which were externalized in the intermediate worker/ssr artifacts) are resolved and bundled. At this stage, the `load` hook runs, generating the definitive, tree-shaken lookup maps with static imports, which are then correctly bundled into the final `worker.js`. This is analogous to how the SSR bridge is bundled.
