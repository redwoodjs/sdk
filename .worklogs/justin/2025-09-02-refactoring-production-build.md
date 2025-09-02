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

## 3. The Path Forward: Fixing the Linker Environment

We are now returning to the original, `worker`-first build order, as it is the only way to get the accurate, tree-shaken list of client components.

`Worker Build -> Client Build -> SSR Build -> Linker Build`

This means we are once again facing the original problem: the `linker` environment is not correctly configured to process the SSR artifacts. Our initial attempt to solve this by manually merging the `worker` and `linker` configurations was brittle and failed.

Our definitive solution is to make the `linker` environment a high-fidelity clone of the `worker` environment, not by merging, but by **inheritance**. The plan is to programmatically construct the `linker` configuration in `configPlugin.mts` by taking the *entire* `worker` config object as a base, and then precisely overriding only the properties essential for the linking step (like `build.rollupOptions.input`).

This ensures that all plugins (including the Cloudflare plugin), resolvers, and other critical settings from the `worker` environment are present and correctly configured for the `linker` phase. When the `linker` bundles the SSR artifacts, they will undergo the exact same transformations as the main worker code, solving the runtime error problem while preserving the necessary `worker`-first build order for accurate tree-shaking.
