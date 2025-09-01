# Work Log: 2025-08-28 - Optimizing Dev Server Dependencies

## 1. Problem Definition & Goal

The primary goal is to improve the developer experience by optimizing how dependencies are handled in the dev server. The core problem has two symptoms:

*   **Slow Initial Startup:** The server takes a long time to become ready.
*   **In-Browser Request Waterfalls:** When using a component from a large library (like Mantine), the browser makes many sequential requests for individual module files, leading to noticeable lag and layout shifts during development.

This is happening because our framework's method of discovering `"use client"` modules forces Vite's `optimizeDeps` feature into an inefficient mode.

## 2. Investigation: Discarded Ideas & Why

We explored several potential solutions, each with a critical flaw:

### Discarded Idea #1: Use esbuild's `metafile` from the `onEnd` hook
*   **What it was:** After Vite's `optimizeDeps` run, we would inspect a `metafile` report to get a precise list of *used* files and filter our list.
*   **Why it was discarded:** Vite does not expose the `metafile` option for `optimizeDeps`. This approach was technically infeasible.

### Discarded Idea #2: Run our own preliminary esbuild pass (the "Two-Pass Strategy")
*   **What it was:** Before Vite starts, we would run our own fast, in-memory esbuild pass on the application's entry points to generate a `metafile` of all reachable files. We'd then use this perfect information to configure `optimizeDeps`.
*   **Why it was discarded:** A naive, standalone esbuild pass would not be aware of the project's Vite configuration, specifically `resolve.alias`. It would fail to resolve aliased paths (e.g., `~/components`), making the solution too fragile for real-world projects.

### Discarded Idea #3: Scan `node_modules` for directives
*   **What it was:** A simpler approach where our existing `findFilesContainingDirective` function would scan the entire `node_modules` directory.
*   **Why it was discarded:** Scanning all of `node_modules` on every server start would be unacceptably slow and defeat the entire purpose of the optimization.

---

## 3. The **ultimately failed** Solution attempt (The Hybrid Approach)

We landed on a pragmatic, hybrid solution that leverages the strengths of both file scanning and Vite's internal machinery, while respecting their limitations.

*   **Step 1: Fast, Targeted Scan of App Code:** Use our `findFilesContainingDirective` function, but strictly limited to scanning only the local application source (`src/`) directory. It will explicitly exclude `node_modules`. This is a very fast operation.

*   **Step 2: Guide Vite's Own Scanner:** The list of *local* `use client` files found in Step 1 is then passed to Vite's configuration:
    *   The file paths are added to **`optimizeDeps.entries`**. This is the crucial instruction. It tells Vite's own powerful, **alias-aware** scanner to trace all the dependencies of our local client components.
    *   When the scanner sees an `import` from a library (e.g., `import { Button } from '@mantine/core'`), it automatically discovers that library.

*   **Step 3: Trigger the "Comprehensive Bundle":** Once Vite discovers a library like `@mantine/core` this way, it adds the *entire package* to its pre-bundling process. This solves the request waterfall and prevents disruptive mid-session re-bundles.

## 4. Rationale & Key Trade-off

*   **Why this works:** It's fast because our manual scan is limited to a small directory. It's robust because we delegate the complex, alias-aware dependency tracing to Vite's own internal, correctly configured scanner.
*   **The Accepted Trade-off:** We are accepting a potentially slower initial server startup because we are pre-bundling entire libraries, not just the used files. However, in exchange, the developer experience during the session will be perfectly smooth, with no request waterfalls and no disruptive re-bundling when new components from an already-bundled library are used.

**End of Day Status:** The hybrid approach seemed like a most viable path forward, despite the trade-off. However, after implementation, it was found to be an **ultimately failed** attempt, for reasons that were not documented at the time.

## 5. September 1, 2025: A New Approach - The Virtual Dependency Barrel

After re-evaluating the problem, we identified a critical flaw in previous thinking. Approaches that relied on `optimizeDeps.include` made a dangerous assumption: that any `"use client"` file found within a package in `node_modules` would be reachable from that package's main entry point. This is not guaranteed. A library could easily use an internal, un-exported client component, which Vite's scanner would never find if it only started from the package's root.

This led to a more robust solution that does not rely on package exports at all.

### The Plan: A Virtual Module for Pre-Bundling

The new strategy is to create a **virtual module** in memory that acts as a "barrel" file, explicitly re-exporting every `"use client"` module found in `node_modules`.

1.  **Identify Client Modules:** During startup, our plugin will still scan the project and its dependencies to populate the `clientFiles` and `serverFiles` sets with the absolute paths of all modules containing the `"use client"` or `"use server"` directives.

2.  **Generate a Virtual Barrel Module:** For the `client` and `ssr` environments, our plugin will create a virtual module (e.g., `virtual:rwsdk:client-module-barrel`). The content of this module will be a list of `export * from '...'` statements, one for each file in `clientFiles` that is located in `node_modules`.

3.  **Configure `optimizeDeps`:** We will add the name of this single virtual module (`virtual:rwsdk:client-module-barrel`) to the `optimizeDeps.entries` array.

### Rationale: Forcing a Single Dependency Graph

This approach is superior because:
-   **It's Explicit:** By feeding Vite a single entry point that directly imports every required module, we leave no room for interpretation. Vite's `esbuild`-powered optimizer is forced to see all library-based client components as part of one large, interconnected dependency graph.
-   **No Unsafe Assumptions:** It completely avoids the problem of internal/un-exported components because we are pointing directly to the specific files, not relying on the library's public API.
-   **Solves the Waterfall:** The result of the optimization will be a single, large chunk containing all the necessary library client code, which can be loaded in one request, definitively solving the in-browser request waterfall.

This plan is contingent on one assumption we'll validate during implementation: that the `client` and `ssr` environment plugins are configured *after* the `worker` environment has completed its initial scan and populated the `clientFiles` set.
