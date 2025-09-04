# The Production Build Process

This document outlines the multi-phase build process used for production environments, designed to orchestrate a series of interdependent Vite builds.

## The Challenge: Waterfalls, Bundle Bloat, and a Dependency Deadlock

The previous production build process had several limitations that led to both poor performance and incorrect behavior in the final deployment. The core of the problem stemmed from how client and server modules were discovered and bundled.

1.  **Production Request Waterfalls:** The build process identified every potential client component via a scan but then generated a client-side lookup map containing a dynamic `import()` for each one, regardless of whether it was actually used. This large number of dynamic import statements caused Rollup (Vite's production bundler) to perform extreme code-splitting, creating a network waterfall of tiny, fragmented chunks that slowed down page loads.

2.  **SSR Bundle Bloat:** Because the list of client components was not filtered to only those used by the application, the Server-Side Rendering (SSR) bundle was larger than necessary, including code for components that would never be rendered.

3.  **Incorrect Transformations & A Build Deadlock:** On top of these performance issues, the build had to solve a fundamental circular dependency between the `worker`, `client`, and `ssr` environments. The previous multi-phase approach to solving this had a critical flaw where code from the `ssr` environment was not correctly processed with necessary Cloudflare-specific transformations, leading to runtime errors.

## The Solution: A Five-Step Build Process

To resolve this, we implement a five-step process that begins with a broad discovery scan, followed by a sequence of Vite builds that progressively refine the artifacts.

### Step 1: Initial Directive Scan

Before any Vite environments are built, we run a standalone `esbuild` scan on the application's `worker` entry point to traverse the entire potential dependency graph and create a master list of every file that contains a `"use client"` or `"use server"` directive.

This scan uses a custom, Vite-aware module resolver that ensures its dependency traversal perfectly mimics the application's actual runtime behavior, correctly handling complex project configurations like TypeScript path aliases. This initial step provides a complete, albeit unfiltered, list of all potential directive modules.

For a detailed explanation of the scanner's implementation and the rationale behind its design, see the [Directive Scanning and Module Resolution](./directiveScanningAndResolution.md) documentation.

### Step 2: Worker Build (First Pass for Discovery & Tree-Shaking)

The `worker` environment is built for the first time. This pass is the key to solving the production inefficiencies:

- **Accurate Tree-Shaking:** This is the essential step where Vite/Rollup performs a full build and tree-shaking on the server-side code. At the end of this build, our custom `directivesFilteringPlugin` inspects the final module graph and compares the master list of client components from the initial scan against the modules that were *actually included* in the final server bundle. This produces an accurate, minimal, and tree-shaken list of *used* client components.
- **Discovery of Side-Effects:** This pass also discovers client entry points, rewrites asset paths to a placeholder format (e.g., `rwsdk_asset:...`), and resolves imports for artifacts that don't exist yet (like the SSR bridge) to external paths.

The output of this phase is an intermediate, non-deployable `worker.js` and, crucially, a pruned list of client components.

### Step 3: SSR Build

The `ssr` build runs next. By using the *pruned* list of `"use client"` components from the first worker pass, it avoids bundling unnecessary code, resulting in a smaller and more efficient SSR artifact.

### Step 4: Client Build

With the list of entry points from the worker pass and the pruned list of used client components, the `client` build is now executed. Because its lookup map now only contains dynamic imports for the components that are actually needed, Rollup can create much larger, more efficient chunks. This solves the production request waterfall. The build runs to completion, producing all the necessary hashed client assets and a `manifest.json` file.

### Step 5: Worker Build (Second "Linker" Pass)

The `worker` environment is built a *second* time. This pass solves two critical problems: it performs the deferred asset linking, and it ensures the SSR artifacts are processed with the correct transformations.

A naive approach would be to create a separate `linker` Vite environment for this step. However, that fails because plugins—especially complex ones like `@cloudflare/vite-plugin` that apply runtime-specific polyfills—are instantiated once and often apply their logic based on the environment's `name`. A separate `linker` environment would not be seen as a Cloudflare-compatible target, and the SSR artifacts it bundles would be missing the necessary transformations, re-introducing the runtime errors.

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
