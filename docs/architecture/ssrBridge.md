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

In a production build, the process addresses a circular dependency between the `worker` and `ssr` environments.

##### The Challenge: A Build-Time Circular Dependency

The core challenge is that:
1. The **`worker`** environment is the only place we can discover the complete list of modules containing a `"use client"` directive, as it is responsible for bundling the user's application code where these directives are found.
2. However, these `"use client"` modules must be bundled by the **`ssr`** environment to ensure they are processed with the correct (non-`"react-server"`) versions of their dependencies.
3. The final **`worker`** bundle must then consume the output of the `ssr` build, treating it as a pre-compiled dependency.

This creates a deadlock: the `ssr` build cannot start until the `worker` build has finished discovering files, but the `worker` build cannot finish until the `ssr` build has produced the necessary artifacts for it to consume.

One might initially think that a preliminary, "discovery-only" pass for the `worker` build would solve this. However, the nature of this problem is not that two full traversals of the module graph are required, but rather that there is "unfinished work" for the `worker` environment that can only be completed after the `ssr` build is done. A discovery pass is therefore semantically incorrect and introduces practical challenges: it creates the potential for duplicated effort, particularly where transformations are a prerequisite for module resolution, and adds significant complexity in trying to control what logic should run in a "discovery" pass versus a "build" pass.

##### The Solution: A Phased, Sequential Build

To solve this efficiently, we implement a multi-phase build process orchestrated by a custom plugin (`rwsdk:config`):

1.  **Phase 1: Initial Worker Build.** The `worker` environment is built first, using the application's source as its entry point. This is a full, productive build, not a throwaway discovery pass. The crucial side-effect of this phase is the collection of all `"use client"` module paths.

2.  **Phase 2: Dynamic SSR Build.** After Phase 1 completes, the `ssr` build is executed. Before it runs, its configuration is dynamically modified in memory. The list of `"use client"` paths collected in Phase 1 is added to its list of entry points, alongside the main SSR Bridge entry. This results in a set of output chunks in a predictable directory (`dist/ssr/`) containing the bridge and all client components, correctly bundled for the SSR environment.

3.  **Phase 3: Final Worker Re-Bundling Run.** The `worker` build is run a *second time*. For this run, the bundling inputs (i.e., entry points) are the output files from the SSR build (Phase 2). This run's purpose is to take the SSR-processed code and re-bundle it through the `worker` environment's toolchain (including the `@cloudflare/vite-plugin`), producing the final, deployable Cloudflare Worker.

4.  **Phase 4: The Client Lookup "Contract".** To link the `worker` to the client components, we establish a "contract". The application code contains a static import to a predictable path, like `import { useClientLookup } from 'rwsdk/__client_lookup.mjs'`. During the Final Worker Re-Bundling Run (Phase 3), a plugin generates the source code for this module—a map from original source paths to their final `ssr` chunk paths—and uses the `this.emitFile` API to create this file at the location specified in the contract. 