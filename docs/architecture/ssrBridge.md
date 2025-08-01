# Architecture: The SSR Bridge

> **Note:** This document provides a high-level overview of the SSR Bridge's initial implementation. It describes the core challenge and the initial solution. Further details on subsequent optimizations and dependency handling will be added.
>
> **TODO:**
> - Document optimizations related to `optimizeDeps` and avoiding transforms for application code.
> - Detail performance improvements made to directive transformations.
> - Explain the logic for invalidating module lookups during development.

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

```mermaid
graph TD
    subgraph Worker Environment (RSC)
        A[App Code] --> B{import 'rwsdk/__ssr_bridge'}
        B -- resolveId --> C[virtual:rwsdk:ssr:rwsdk/__ssr_bridge]
        C -- load --> D{ssrBridgePlugin}
        D -- devServer.environments.ssr.fetchModule() --> E
        D -- returns transformed code --> F[Transformed Code w/ virtual imports]
        F --> A
    end

    subgraph SSR Environment
        E[Original SSR Module]
        E -- Vite's SSR transform pipeline --> G[SSR-transformed code]
        G --> D
    end
```

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
In a production build, the process is simpler and based on pre-building.
1.  First, a separate Vite build runs for the `ssr` environment, using the bridge module as its entry point. This produces a single, self-contained SSR bundle file.
2.  Next, the main `worker` environment build runs.
3.  When the `worker` build encounters the import for the SSR bridge, the plugin simply resolves the import path to the location of the pre-built SSR bundle from step 1.

In effect, the SSR bundle is treated like a third-party library by the main `worker` build. This two-step process ensures that both environments are built with their respective configurations and then combined to run in the final Cloudflare Worker. 