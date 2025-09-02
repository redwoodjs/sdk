# The Production Build Process

This document outlines the multi-phase build process used for production environments, designed to orchestrate a series of interdependent Vite builds.

## The Challenge: A Deadlock of Circular Dependencies

The production build must solve several interconnected problems simultaneously. We use multiple, specialized Vite environments (`worker`, `client`, `ssr`), and they have circular information dependencies that create a classic build deadlock:

1.  **Client/Worker Dependency:** The `worker` build is responsible for traversing the application's component tree. During this traversal, it discovers all client-side JavaScript entry points (from `<script>` tags and dynamic `import()` calls). This list of entry points is the essential input for the `client` build. Therefore, the `worker` build must run *before* the `client` build.

2.  **SSR/Worker Dependency:** The `worker` environment needs to bundle the output of the `ssr` build, which includes server-rendered component code and crucial lookup maps. Therefore, the `ssr` build must run *before* the final `worker` bundle is created.

3.  **The Deadlock:** These requirements create a contradiction. The `worker` must run before the `client`, but the `ssr` must run before the `worker`. Complicating this, the `ssr` build itself needs a tree-shaken list of *used* client components, which is only accurately produced *after* the `worker` build has performed its own tree-shaking.

## The Solution: A Scan-First, Two-Pass Build

To resolve this, we implement a process that begins with a broad discovery scan, followed by a two-pass `worker` build that progressively refines the build artifacts.

### Step 1: Initial Directive Scan

Before any Vite environments are built, we run a fast, preliminary `esbuild` scan on the application's `worker` entry point.

-   **Purpose:** The goal of this scan is to traverse the entire potential dependency graph and create a master list of every file that contains a `"use client"` or `"use server"` directive.
-   **Vite Compatibility:** This scan is configured to use a custom plugin that mirrors Vite's own resolving capabilities, allowing it to correctly handle project-specific configurations like `resolve.alias`.

This initial step provides a complete, albeit unfiltered, list of all potential directive modules.

### Step 2: The Two-Pass Worker Build

With the master list of directives, the sequential build can begin. The core of the solution is to run the `worker` build twice, with each pass serving a distinct purpose.

1.  **`RWSDK_BUILD_PASS='worker'` (First Pass):** The `worker` environment is built for the first time.
    *   **Primary Goal: Accurate Tree-Shaking.** This pass is essential because it allows Vite/Rollup to perform a full build and tree-shaking on the server-side code. At the end of this build, our custom `directivesFilteringPlugin` compares the master list from the initial scan against Vite's final module graph. It removes any directive file that was not actually included in the final bundle, producing an accurate, minimal list of *used* components.
    *   **Other Side-Effects:** This pass also discovers client entry points, rewrites asset paths to a placeholder format (e.g., `rwsdk_asset:...`), and resolves imports for artifacts that don't exist yet (like the SSR bridge) to external paths. The output is an intermediate, non-deployable `worker.js`.

2.  **Client Build:** With the list of entry points and the refined list of used client components from Pass 1, the `client` build is now executed, producing hashed assets and a `manifest.json`.

3.  **SSR Build:** The `ssr` build runs next, using the refined list of `"use client"` components to ensure only the necessary server-side code is included. This build produces intermediate SSR artifacts.

4.  **`RWSDK_BUILD_PASS='linker'` (Second Pass):** The `worker` environment is built a *second* time. This pass solves the critical problem of ensuring SSR artifacts are processed by the same plugins (e.g., `@cloudflare/vite-plugin`) as the main worker code.
    *   **Primary Goal: Consistent Transformations.** The `worker` environment is reconfigured in-memory to use the intermediate `worker.js` and the SSR artifacts as its input.
    *   **Pass-Aware Plugins:** Our custom plugins check the `RWSDK_BUILD_PASS` variable and execute different logic. The `linkerPlugin` becomes active, replacing asset placeholders with their final paths from the manifest. The `ssrBridgePlugin` and lookup plugins switch from resolving to external paths to resolving to the *actual* SSR artifacts, allowing them to be bundled. Source-transforming plugins like `directivesPlugin` are disabled.
    *   **Guaranteed Consistency:** Because this pass runs within the *exact same*, fully-resolved `worker` environment, the SSR artifacts are processed by the same set of plugins as the original worker code.

The final output is a single, correctly transformed, and fully linked `worker.js` file, ready for deployment.
