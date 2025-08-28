# The Production Build Process

This document outlines the multi-phase build process used for production environments.

## The Challenge: Orchestrating Inter-Dependent Environments

The production build must solve several interconnected problems simultaneously, arising from the use of multiple, specialized Vite environments (`worker`, `client`, `ssr`) that have circular information dependencies:

1.  **SSR / Worker Dependency:** The `worker` environment, which is configured for React Server Components (RSC), must bundle the entire output of the `ssr` build. The `ssr` environment handles traditional server-side rendering. For a detailed explanation of how these environments interact, see the [SSR Bridge](./ssrBridge.md) architecture document. This creates a build ordering dependency: the `ssr` build must complete before the final `worker` build can begin.

2.  **Dynamic Client Entry Points:** The `client` build needs a list of all client-side JavaScript entry points (e.g., from `<script>` tags) to know what to bundle. This information is only available by traversing the application's `Document.tsx` components, which occurs during the `worker` build.

3.  **Tree-Shaking for Client and SSR Components:** Both the `ssr` and `client` builds need to know which `"use client"` components are actually used by the application. In the `ssr` build, this information is used to avoid bundling unnecessary server-side code for unused components. In the `client` build, it allows for more optimal code-splitting, preventing the creation of overly granular chunks that result from a bundler seeing every potential client component as a dynamic import. This list is discoverable by traversing the application graph within the `worker` build.

4.  **Deferred Asset Linking:** The final `worker` bundle needs to contain the correct, hashed output paths of all client assets (e.g., `/assets/client.a1b2c3d4.js`). These paths are only known after the `client` build has run and generated its `manifest.json`.

5.  **Client Component Lookup:** The `worker` environment needs to dynamically load the SSR-processed versions of client components at runtime. This requires a lookup map—the `__client_lookup.mjs` module—that translates a component's source path to its final, bundled SSR chunk path. This map can only be generated during the `ssr` build.

These points create a deadlock. The `worker` build needs information from the `client` build (the manifest) and the `ssr` build (the bridge and lookup map bundles), but both of those builds need information discovered during the `worker` build.

## The Solution: A Phased, Sequential Build

To resolve this, we implement a **four-phase** sequential build process. Each of the first three phases produces artifacts that are used as inputs for a final "linking" phase, which assembles the deployable worker.

### Phase 1: Worker Pass

The `worker` environment is built first. This is a full build pass that performs all necessary transformations on the application source code (`src/worker.tsx`). This phase involves two main stages:

1.  **Discovery:** As Vite traverses the source graph, a custom plugin identifies all modules that contain a `"use client"` directive, adding them to a preliminary list of potential client components.
2.  **Filtering:** After Vite completes its build and generates the tree-shaken module graph for the worker, another custom plugin hook (`buildEnd`) runs. This hook iterates through the preliminary list of client components. For each component, it queries Vite's module graph metadata to determine if the component was actually included in the final worker bundle (`isIncluded`). Any component that was tree-shaken away by Vite is removed from the list.

The crucial **side-effects** of this phase are two refined lists:
- A complete and accurate list of all modules containing a `"use client"` directive that are part of the worker's final module graph.
- A complete list of all client-side entry points.

During this phase:
- Transformations that reference client assets (like `<script src="...">`) rewrite them into a special placeholder format (e.g., `rwsdk_asset:/src/client.tsx`).
- Special imports for the SSR bridge (`rwsdk/__ssr_bridge`), lookup maps (`rwsdk/__client_lookup`, `rwsdk/__server_lookup`), and manifest (`virtual:rwsdk:manifest.js`) are intercepted. The plugins resolve these to **external, relative paths** that will be satisfied in the final linking phase (e.g., `{ id: './__ssr_bridge.js', external: true }`).

The output of this phase is an intermediate `dist/worker/worker.js` bundle. This bundle is not yet deployable.

### Phase 2: Client Build

With the list of entry points and the refined list of used client components discovered in Phase 1, the `client` build is now executed. Its configuration is dynamically updated. Vite uses the entry points for its initial graph traversal and the full list of used client components to inform its code-splitting strategy, resulting in more optimal, less granular chunks. This build runs to completion, producing all the necessary hashed client assets and a `manifest.json` file.

### Phase 3: SSR Build

The `ssr` build runs next. Its configuration is dynamically updated with multiple entry points: the main SSR Bridge and the filtered list of `"use client"` components discovered in Phase 1. This ensures that only the server-side code for components actively used by the application is included in the SSR bundle. This build produces intermediate SSR artifacts in the `dist/ssr` directory.

### Phase 4: Linker Build Pass

The final phase is a distinct Vite build pass that uses a dedicated, minimal `linker` environment. This pass does not process the original application source code. Instead, its purpose is to assemble, or "link," the artifacts from the previous three phases into a final, deployable bundle.

The `linker` environment:
- Is configured for the target worker environment (e.g., Cloudflare Workers), but includes almost none of the source-transforming plugins used in Phase 1.
- Takes a single, virtual "barrel" file as its input. This file is generated in memory and contains only `import` statements for the key artifacts:
  - The intermediate `worker.js` from Phase 1.
  - The SSR bridge and lookup bundles from Phase 3.
  - The `manifest.json` from Phase 2.
- A custom plugin, active only in this environment, performs the final linking:
  1.  It uses the imported manifest data to perform a search-and-replace across the worker code, replacing all `rwsdk_asset:...` placeholders with their correct, final, hashed asset paths.
  2.  It bundles all the imported artifacts into a single, final `worker.js` file in the output directory.

This approach keeps the entire build process within the Vite ecosystem, using a declarative environment to handle the final assembly cleanly and efficiently.
