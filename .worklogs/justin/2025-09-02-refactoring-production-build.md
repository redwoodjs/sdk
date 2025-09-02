# Work Log: 2025-09-02 - Refactoring the Production Build Process

## 1. Initial State & Problem Definition

The production build process was originally designed as a four-phase sequential build to solve a series of circular dependencies between the `worker`, `client`, and `ssr` Vite environments. The process was:

1.  **Worker Pass:** A partial worker build runs to discover client entry points and `"use client"` components.
2.  **Client Build:** Uses information from the worker pass to build the client assets.
3.  **SSR Build:** Also uses information from the worker pass to build server-side rendered components.
4.  **Linker Pass:** A final pass assembles the artifacts from all previous passes into a deployable `worker.js`.

The critical flaw in this design is that the `ssr` artifacts are generated in a separate environment but only bundled into the final output during the `linker` phase. The `linker` is a minimal environment and does not run the full suite of plugins that the `worker` environment does (specifically, the `@cloudflare/vite-plugin`).

As a result, the code from the `ssr` build is not processed with the necessary polyfills and transformations (e.g., for `nodejs_compat`) required to run in the Cloudflare Workers runtime. This leads to runtime errors in `vite preview` when the final, linked worker is executed.

## 2. Attempt 1: Configuration Inheritance

Our first attempt to solve this was to make the `linker` environment aware of the `worker` environment's configuration.

-   **The Idea:** Programmatically merge the fully resolved Vite configuration from the `worker` environment into the `linker` environment's configuration just before the linker build pass is executed.
-   **Rationale:** We believed this would ensure the linker applied the same Cloudflare-specific transformations to all the code it was bundling, including the SSR artifacts.
-   **Outcome:** This approach was abandoned. It proved to be overly complex and brittle, requiring fragile, deep merges of Vite's internal configuration objects. It became difficult to maintain and failed to correctly combine critical settings like `rollupOptions.plugins`, which still resulted in an improperly configured build.

## 3. The Solution: A Scan-First, Sequential Build Process

We are now pivoting to a new strategy that re-architects the build process to be more robust and predictable by eliminating the need for the linker to process untransformed SSR artifacts. The new, sequential build process will be:

1.  **Pre-Scan:** A `directiveModulesBuildPlugin` will execute a standalone `esbuild` scan of the application source. This scan populates the `clientFiles` and `serverFiles` sets, providing a complete list of all directive-marked modules upfront.
2.  **SSR Build:** With the list of client components now available, the `ssr` build can run first. It will generate its intermediate artifacts, including the SSR bridge.
3.  **Worker Build (with direct bundling):** The `worker` build runs next. When it encounters the import for the SSR bridge, the `ssrBridgePlugin` will now resolve it directly to the intermediate artifact from the `ssr` build, bundling it in. The output from this phase is an intermediate `worker.js` that contains all necessary server-side code, which has been correctly processed by the Cloudflare plugin.
4.  **Client Build:** The `worker` build also discovers the client-side entry points, which are then used to execute the `client` build, producing the final assets and `manifest.json`.
5.  **Simplified Linker Build:** The `linker` phase's role is now greatly simplified. It no longer handles SSR artifacts. Its sole responsibility is to perform deferred asset linking by replacing placeholders in the intermediate `worker.js` with the final, hashed asset paths from the client manifest.

This approach creates a more logical and linear flow of information. The `worker` environment, which is fully configured for the Cloudflare runtime, is responsible for processing *all* server-side code (including the SSR output), ensuring a consistent and correctly transformed final bundle.
