# Architecture: The SSR Bridge

## The Challenge: Supporting Multiple Runtimes in One Environment

The core of the framework's architecture involves rendering React Server Components (RSC) and then using a traditional Server-Side Render (SSR) to generate the final HTML. Both of these operations must occur within the same Cloudflare Worker.

This presents a significant bundling challenge. The RSC and SSR runtimes require different builds of React and its dependencies. The distinction is typically managed by a `package.json` conditional export called `"react-server"`. An RSC-compatible build uses packages that respect this condition, while a standard SSR build does not.

A single Vite environment cannot be configured to handle both sets of dependency requirements simultaneously. We need a way to process modules according to two different sets of rules, but ultimately bundle them to run in a single Cloudflare Worker. Solving this at the infrastructure level (e.g., by deploying two separate workers) would be inappropriate, as it is fundamentally a build-time and bundling problem. The solution must exist within the bundler itself.

## The Solution: A Bridge Between Vite Environments

Vite's [Environments API](https://vitejs.dev/guide/api-vite-environment.html) provides the necessary foundation to solve this. It allows us to define multiple, isolated configuration contexts within a single Vite server. We use this to create two distinct environments:

- **`worker`**: The primary environment, configured for RSC. It respects the `"react-server"` export condition. All code ultimately runs in this environment.
- **`ssr`**: A secondary environment, configured for traditional SSR. It does **not** use the `"react-server"` condition.

To connect them, we introduced the concept of the **SSR Bridge**. The bridge is a special entry point (`rwsdk/__ssr_bridge`) that acts as a gateway to the `ssr` environment. Any code that needs to be rendered on the server (i.e., the "SSR" part of the RSC-then-SSR process) must pass through this bridge.

A custom Vite plugin, `ssrBridgePlugin`, orchestrates the process. It creates a virtual "subgraph" of SSR modules within the main `worker` environment. This allows the `worker` to effectively borrow the `ssr` environment's configuration for a specific set of modules, solving the dependency conflict without requiring separate deployments.

### The End Goal: A Hydratable HTML Stream

It is important to understand that the SSR Bridge is a build-time mechanism that enables a specific runtime outcome. The ultimate goal of this entire process is to feed the RSC payload into a traditional React server renderer (`renderToReadableStream`) to produce a complete, hydratable HTML document.

By allowing the `worker` environment to access a correctly configured `ssr` version of the renderer via the bridge, the framework can successfully perform the final rendering phase. This includes generating the necessary state required for client-side hydration to work correctly, solving issues like `useId` mismatches. For a detailed explanation of this final rendering step, see the [RSC to HTML Rendering](./rscSsrProcess.md) document.

### How It Works: Dev vs. Production

The implementation differs slightly between development and production builds.

#### In Development

In development, the process is dynamic.

1.  When the `ssrBridgePlugin` sees an import for the bridge in the `worker` environment, it returns a virtual module ID prefixed with `virtual:rwsdk:ssr:`.
2.  Vite then asks the plugin's `load` hook how to resolve this virtual ID.
3.  The plugin calls `devServer.environments.ssr.fetchModule()`, asking the `ssr` environment to process the actual file.
4.  The `ssr` environment resolves and transforms the module according to its own rules (e.g., using the standard React build).
5.  The transformed code is returned to the `worker` environment.
6.  Before finishing, the plugin inspects the returned code for any further imports. It rewrites these imports to also be prefixed with `virtual:rwsdk:ssr:`, ensuring that the entire dependency chain remains within the virtual SSR subgraph.

#### Non-JS Assets in the Bridge

Not all modules can safely pass through the SSR environment's transform pipeline. Some static assets are kept out of the SSR subgraph so they can be handled by Vite (and the Cloudflare Vite plugin) in the `worker` environment instead:

- **CSS files**: These are already processed by the `worker` environment's own pipeline. The bridge strips the synthetic `.js` suffix it adds for internal routing and returns an empty module so the worker's CSS handling remains in control.
- **JSON files**: Vite's JSON plugin transforms `.json` imports in the SSR environment into code containing SSR-only helpers (such as `__vite_ssr_exportName__`) that the Cloudflare worker runner cannot execute. When the bridge rewrites the import callsites inside SSR-fetched code, it leaves JSON specifiers unchanged so they are resolved and transformed by the `worker` environment instead.
- **`?raw` imports**: Vite 8 denies IDs containing `?raw` in the SSR bridge context. When the bridge rewrites import callsites, it leaves `?raw` specifiers unchanged so they are handled by the `worker` environment's own asset pipeline.

This applies both to imports inside bridged modules and to direct JSON/`?raw` imports in the `worker` environment, keeping non-JS assets out of the SSR transform path.

#### Worker Transform Boundary

Modules inside the virtual SSR subgraph are identified by IDs that start with `virtual:rwsdk:ssr:`. Vite may also surface those modules through its `/@id/` URL form, which is normalized back to the same virtual ID before bridge logic runs. They have already been resolved and transformed by the `ssr` environment before the `worker` environment sees them. Worker-side discovery transforms must treat those IDs as read-only bridge output and must not rewrite them again. For example, script/link tag discovery runs on normal worker `.tsx` modules, but skips virtual SSR modules to avoid injecting duplicate imports into already-transformed bridge code.

#### In Production

##### The Challenge: Linking Separate Bundles

In a production build, the `worker` and `ssr` environments must be bundled separately to handle their unique dependency requirements (e.g., the `"react-server"` condition). This creates a complex set of build-time dependencies that must be carefully orchestrated.

##### The Solution: A Multi-Phase Build

The production build uses a multi-phase, sequential process to correctly bundle all environments. For a complete explanation of this architecture, see the central [Production Build Process](./productionBuildProcess.md) document.

### Dev Server Stability

The use of multiple, interconnected Vite environments introduces challenges during development, particularly around dependency re-optimization. For a detailed explanation of how the system handles race conditions and ensures a stable development experience, see the [Dev Server Stability](./devServerStability.md) document.
