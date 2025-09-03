# The Production Build Process

This document outlines the multi-phase build process used for production environments, designed to orchestrate a series of interdependent Vite builds.

## The Challenge: A Deadlock of Circular Dependencies

The production build must solve several interconnected problems simultaneously. We use multiple, specialized Vite environments (`worker`, `client`, `ssr`), and they have circular information dependencies that create a classic build deadlock:

1.  **Client Entry Discovery:** The `worker` build is responsible for traversing the application's component tree. During this traversal, it discovers all client-side JavaScript entry points (from `<script>` tags and dynamic `import()` calls). This list of entry points is the essential input for the `client` build. Therefore, the `worker` build must run *before* the `client` build.

2.  **SSR Artifact Bundling:** The `worker` environment needs to bundle the output of the `ssr` build, which includes server-rendered component code and crucial lookup maps. Therefore, the `ssr` build must run *before* the final `worker` bundle is created.

3.  **Deferred Asset Linking:** The `worker` build generates references to client-side assets (like `<script src="...">`), but it can't know their final, hashed filenames. It must instead write placeholder paths (e.g., `rwsdk_asset:/src/client.tsx`). Only after the `client` build completes is a `manifest.json` file generated that maps these placeholders to their final output paths (e.g., `/assets/client.a1b2c3d4.js`). A final linking step must then run *after* the `client` build to replace the placeholders in the worker's code.

4.  **The Deadlock:** These requirements create a multi-faceted contradiction. The `worker` must run first to provide entry points for the `client` and a tree-shaken component list for the `ssr` build. But the final `worker` bundle also depends on the output of both the `client` (for the manifest) and `ssr` builds.

## The Solution: A Five-Step Build Process

To resolve this, we implement a five-step process that begins with a broad discovery scan, followed by a sequence of Vite builds that progressively refine the artifacts.

### Step 1: Initial Directive Scan

Before any Vite environments are built, we run a fast, preliminary `esbuild` scan on the application's `worker` entry point.

-   **Purpose:** The goal of this scan is to traverse the entire potential dependency graph and create a master list of every file that contains a `"use client"` or `"use server"` directive.
-   **Vite Compatibility:** This scan is configured to use a custom plugin that mirrors Vite's own resolving capabilities, allowing it to correctly handle project-specific configurations like `resolve.alias`.

This initial step provides a complete, albeit unfiltered, list of all potential directive modules.

### Step 2: Worker Build (First Pass for Discovery & Tree-Shaking)

The `worker` environment is built for the first time. This pass has two primary goals:

- **Accurate Tree-Shaking:** This is the essential step where Vite/Rollup performs a full build and tree-shaking on the server-side code. At the end of this build, our custom `directivesFilteringPlugin` compares the master list from the initial scan against Vite's final module graph. It removes any directive file that was not actually included in the final bundle, producing an accurate, minimal list of *used* components.
- **Discovery of Side-Effects:** This pass also discovers client entry points, rewrites asset paths to a placeholder format (e.g., `rwsdk_asset:...`), and resolves imports for artifacts that don't exist yet (like the SSR bridge) to external paths.

The output of this phase is an intermediate, non-deployable `worker.js`.

### Step 3: SSR Build

The `ssr` build runs next, using the refined list of `"use client"` components from the first worker pass to ensure only the necessary server-side code is included. This build produces intermediate SSR artifacts.

### Step 4: Client Build

With the list of entry points and the refined list of used client components from the first worker pass, the `client` build is now executed. It runs to completion, producing all the necessary hashed client assets and a `manifest.json` file.

### Step 5: Worker Build (Second "Linker" Pass)

The `worker` environment is built a *second* time. This pass solves two critical problems: it performs the deferred asset linking, and it ensures the SSR artifacts are processed with the correct transformations.

A naive approach would be to use a separate `linker` Vite environment for this step. However, that fails because plugins—especially complex ones like `@cloudflare/vite-plugin` that apply runtime-specific polyfills and transformations—are instantiated once and often apply their logic based on the environment's `name`. A separate `linker` environment would not be seen as a Cloudflare-compatible target, and the SSR artifacts it bundles would be missing the necessary transformations, leading to runtime errors.

Our solution is to reuse the *exact same*, fully-resolved `worker` environment object for this second pass. This guarantees consistency.

- **Primary Goal: Consistent Transformations & Linking.** The `worker` environment is reconfigured in-memory to use the intermediate `worker.js` and the SSR artifacts as its input.
- **Pass-Aware Plugins:** Our custom plugins check the `RWSDK_BUILD_PASS` environment variable (set to `'linker'` for this pass) and execute different logic. The `linkerPlugin` becomes active, reading the `manifest.json` and replacing asset placeholders with their final paths. The `ssrBridgePlugin` and lookup plugins switch from resolving to external paths to resolving to the *actual* SSR artifacts, allowing them to be bundled. Source-transforming plugins are disabled.
- **Guaranteed Consistency:** Because this pass runs within the already-configured `worker` environment, the SSR artifacts are processed by the exact same set of plugins as the original worker code, ensuring a correct and consistent final bundle.

The final output is a single, correctly transformed, and fully linked `worker.js` file, ready for deployment.

## A Deeper Dive: Generating Directive Lookup Maps

A critical but complex task in the build process is the generation of the `use client` and `use server` lookup maps. These are virtual modules that provide React with a manifest of all directive components, but they present a unique challenge that exemplifies the build's circular dependencies.

### The Challenge: Post-Tree-Shaking Generation

The core challenge is that the lookup maps can only be finalized *after* the tree-shaking in the first worker pass (Step 2) is complete. If we generated them during the initial scan (Step 1), they would be bloated with every potential client and server component in the project, not just the ones that are actually used.

Furthermore, an early attempt to generate the maps using dynamic imports in the final linker step was found to be flawed. This approach caused the bundler to incorrectly code-split the server-side logic into separate assets, leading to "split-brain" bugs where server state was not persisted correctly between a server action's execution and the subsequent component re-render. The maps must be generated using static imports to be bundled correctly.

### The Solution: Environment-Aware Deferral

To solve this, our lookup plugins use a nuanced, environment-aware strategy to control exactly when the virtual lookup modules are generated and bundled.

-   **Worker Pass (Step 2):** The plugins instruct the bundler to treat the lookup map modules as external references. This is the essential deferral step. It allows for a filtering process at the end of this pass to produce the final, tree-shaken list of components *before* the map's contents are ever generated. The intermediate worker artifact contains an unresolved reference to the map.

-   **SSR Pass (Step 4):** The lookup maps are also kept external. This is crucial for consistency. It ensures that both the intermediate worker and SSR artifacts refer to the same abstract identifier for the map. This prevents module duplication and guarantees they will both use a single, shared lookup map in the final step.

-   **Client Pass (Step 3):** The client-side lookup map is generated and bundled. At this point, the tree-shaken list of client components is available, and the client build can generate its own version of the map with static imports.

-   **Linker Pass (Step 5):** Finally, the server-side lookup maps—which were treated as external references in the intermediate worker and SSR artifacts—are generated and bundled. At this stage, the plugin provides the definitive, tree-shaken contents for the lookup maps. These are then correctly bundled directly into the final `worker.js`, solving both the tree-shaking and state-loss issues.
