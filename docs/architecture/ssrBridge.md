# Architecture: The SSR Bridge

> **Note:** This document provides a high-level overview of the SSR Bridge's initial implementation. It describes the core challenge and the initial solution. Further details on subsequent optimizations and dependency handling will be added.
>
> **TODO:**
> - Document optimizations related to `optimizeDeps` and avoiding transforms for application code.
> - Detail performance improvements made to directive transformations.
> - Explain the logic for invalidating module lookups during development.
> - Maintaining module graph for SSR subgraph

## The Challenge: Supporting Multiple Runtimes in One Environment

The core of Redwood SDK's architecture involves rendering React Server Components (RSC) and then using a traditional Server-Side Render (SSR) to generate the final HTML. Both of these operations must occur within the same Cloudflare Worker.

This presents a significant bundling challenge. The RSC and SSR runtimes require different builds of React and its dependencies. The distinction is typically managed by a `package.json` conditional export called `"react-server"`. An RSC-compatible build uses packages that respect this condition, while a standard SSR build does not.

A single Vite environment cannot be configured to handle both sets of dependency requirements simultaneously. We need a way to process modules according to two different sets of rules, but ultimately bundle them to run in a single Cloudflare Worker. Solving this at the infrastructure level (e.g., by deploying two separate workers) would be inappropriate, as it is fundamentally a build-time and bundling problem. The solution must exist within the bundler itself.

## The Solution: A Bridge Between Vite Environments

Vite's [Environments API](https://vitejs.dev/guide/api-vite-environment.html) provides the necessary foundation to solve this. It allows us to define multiple, isolated configuration contexts within a single Vite server. We use this to create two distinct environments:
-   **`worker`**: The primary environment, configured for RSC. It respects the `"react-server"` export condition. All code ultimately runs in this environment.
-   **`ssr`**: A secondary environment, configured for traditional SSR. It does **not** use the `"react-server"` condition.

To connect them, we introduced the concept of the **SSR Bridge**. The bridge is a special entry point (`rwsdk/__ssr_bridge`) that acts as a gateway to the `ssr` environment. Any code that needs to be rendered on the server (i.e., the "SSR" part of the RSC-then-SSR process) must pass through this bridge.

A custom Vite plugin, `rwsdk:ssr-bridge`, orchestrates the process. It creates a virtual "subgraph" of SSR modules within the main `worker` environment. This allows the `worker` to effectively borrow the `ssr` environment's configuration for a specific set of modules, solving the dependency conflict without requiring separate deployments.

### The End Goal: A Hydratable HTML Stream

It is important to understand that the SSR Bridge is a build-time mechanism that enables a specific runtime outcome. The ultimate goal of this entire process is to feed the RSC payload into a traditional React server renderer (`renderToReadableStream`) to produce a complete, hydratable HTML document.

By allowing the `worker` environment to access a correctly configured `ssr` version of the renderer via the bridge, the framework can successfully perform the final rendering phase. This includes generating the necessary `resumableState` required for client-side hydration to work correctly, solving issues like `useId` mismatches. For a detailed explanation of this final rendering step, see the [RSC to HTML Rendering](./rscSsrProcess.md) document.

### How It Works: Dev vs. Production

The implementation differs slightly between development and production builds.

#### In Development

In development, the process is dynamic.
1.  When the `ssrBridgePlugin` sees an import for the bridge in the `worker` environment, it returns a virtual module ID prefixed with `virtual:rwsdk:ssr:`.
2.  Vite then asks the plugin's `load` hook how to resolve this virtual ID.
3.  The plugin calls `devServer.environments.ssr.fetchModule()`, asking the `ssr` environment to process the actual file.
4.  The `ssr` environment resolves and transforms the module according to its own rules (e.g., using the standard React build).
5.  The transformed code is returned to the `worker` environment.
6.  Before finishing, the plugin wraps the returned code to ensure that any *further* imports within it are also prefixed with `virtual:rwsdk:ssr:`. This keeps the entire dependency chain within the virtual SSR subgraph, ensuring all nested modules are processed correctly by the `ssr` environment.

#### In Production

##### The Challenge: Linking Separate Bundles

In a production build, the `worker` and `ssr` environments must be bundled separately to handle their unique dependency requirements (e.g., the `"react-server"` condition). This creates a complex set of build-time dependencies that must be carefully orchestrated.

##### The Solution: A Multi-Phase Build

The production build uses a multi-phase, sequential process to correctly bundle all environments. For a complete explanation of this architecture, see the central [Production Build Process](./productionBuildProcess.md) document. 