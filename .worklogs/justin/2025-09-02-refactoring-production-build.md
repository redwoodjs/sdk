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
