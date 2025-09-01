# Work Log: 2025-09-01 - Optimizing Dev Server Dependencies

## 1. Problem Definition & Goal

The primary goal is to improve the developer experience by optimizing how dependencies are handled in the dev server. The core problem has two symptoms:

*   **Slow Initial Startup:** The server takes a long time to become ready.
*   **In-Browser Request Waterfalls:** When using a component from a large library (like Mantine), the browser makes many sequential requests for individual module files, leading to noticeable lag and layout shifts during development.

This is happening because our framework's method of discovering `"use client"` modules forces Vite's `optimizeDeps` feature into an inefficient mode where it creates many small, fragmented chunks for library components instead of a single, unified one.

## 2. Investigation: Discarded Ideas & Why

We explored several potential solutions, each with a critical flaw:

*   **Use esbuild's `metafile`:** This was technically infeasible as Vite does not expose the `metafile` option for `optimizeDeps`.
*   **Run a preliminary esbuild pass:** A standalone esbuild pass would be unaware of the project's Vite configuration (e.g., `resolve.alias`), making it too fragile.
*   **Scan `node_modules`:** This would be unacceptably slow and defeat the purpose of the optimization.
*   **Use `optimizeDeps.include`:** This made a dangerous assumption that any `"use client"` file within a package would be reachable from that package's main entry point, which is not guaranteed for internal, un-exported components.

## 3. The Solution: The Virtual Dependency Barrel

We've landed on a robust solution that does not rely on package exports at all. The strategy is to create a **virtual module** in memory that acts as a "barrel" file, explicitly re-exporting every `"use client"` module found in `node_modules`.

1.  **Identify Client Modules:** During startup, our plugin will scan the project and its dependencies to populate the `clientFiles` set with the absolute paths of all modules containing the `"use client"` directive.
2.  **Generate a Virtual Barrel Module:** For the `client` and `ssr` environments, our plugin will create a virtual module (e.g., `virtual:rwsdk:client-module-barrel`). The content of this module will be a list of `export * from '...'` statements, one for each file in `clientFiles` that is located in `node_modules`.
3.  **Configure `optimizeDeps`:** We will add the name of this single virtual module to the `optimizeDeps.entries` array. A similar process will be followed for server modules.

### Rationale: Forcing a Single Dependency Graph

This approach is superior because:

-   **It's Explicit:** By feeding Vite a single entry point that directly imports every required module, we force its optimizer to see all library-based client components as part of one large, interconnected dependency graph.
-   **No Unsafe Assumptions:** It completely avoids the problem of internal/un-exported components because we are pointing directly to the specific files, not relying on the library's public API.
-   **Solves the Waterfall:** The result of the optimization will be a single, large chunk containing all the necessary library client code, which can be loaded in one request, definitively solving the in-browser request waterfall.

This plan is contingent on one assumption we'll validate during implementation: that the `client` and `ssr` environment plugins are configured *after* the `worker` environment has completed its initial scan and populated the `clientFiles` set.

