# Dev Server Dependency Optimization

This document outlines the strategy used to optimize third-party dependencies in the development server, addressing performance issues like slow startup and in-browser request waterfalls.

## The Challenge: Inefficient Pre-Bundling and Request Waterfalls

The core problem is a performance bottleneck in the development server that manifests in two ways:

*   **Slow Initial Startup:** The server takes a long time to become ready.
*   **In-Browser Request Waterfalls:** When using a component from a large library (like Mantine), the browser makes many sequential requests for individual module files, leading to noticeable lag and layout shifts during development.

This happens because our framework's method of discovering `"use client"` modules forces Vite's dependency pre-bundling feature (`optimizeDeps`) into an inefficient mode. Instead of creating a single, unified chunk for a library's components, it creates many small, fragmented chunks, which leads directly to the request waterfall.

Attempting to solve this by hooking into Vite's internal optimizer lifecycle—through methods like monkey-patching or complex synchronization—proved to be brittle, unstable, and overly complex.

## The Solution: A Standalone Scan Paired with Package Subpath Exports

The final, robust solution works *with* Vite's architecture rather than fighting it. It gives us full control over the discovery process and then communicates the results to Vite using standard, public APIs. The strategy has two main parts.

### 1. A Controlled, Standalone `esbuild` Scan

Before Vite's dev server starts, we run our own, separate `esbuild` scan.
-   **Exhaustive Discovery:** This scan starts from the application's entry points and traverses the entire dependency graph. Because we control this process, we can ensure it is exhaustive. A custom `esbuild` plugin reads the content of every resolved module and checks for `"use client"` or `"use server"` directives, populating a complete and accurate list of all directive-marked files.
-   **Configuration-Aware:** Crucially, this standalone scan is configured to use the application's final, resolved Vite configuration (including `resolve.alias`). This ensures its module resolution perfectly mimics the application's runtime behavior, making the scan both accurate and reliable.

With this scan complete, we have a definitive list of all client components *before* Vite's optimizer begins its work.

### 2. "Barrel as a Package Subpath"

The second part of the solution addresses how we communicate this list to Vite's optimizer. Instead of relying on virtual modules or other complex tricks, we use a standard, declarative feature of the Node.js ecosystem.

1.  **Generate Physical Barrel Files:** We generate physical "barrel" files on disk. For example, `__client_barrel.js` is created containing an `export * from '...'` statement for every discovered client component.
2.  **Declare as Package Subpaths:** We add these barrel files to our `sdk/package.json` under the `"exports"` map. For example:
    ```json
    "exports": {
      "./__client_barrel": "./dist/__intermediate_builds/client-barrel.js"
    }
    ```
    This elevates our barrel files from simple files to official, resolvable parts of our `rwsdk` package.
3.  **Inform the Optimizer:** We then add these package subpaths (e.g., `rwsdk/__client_barrel`) to the `optimizeDeps.include` array in Vite's configuration.
4.  **Use Standard Imports:** Finally, our runtime lookup plugins generate standard, dynamic imports (e.g., `import('rwsdk/__client_barrel')`).

### Rationale: Aligning with the Ecosystem

This approach is superior because it aligns perfectly with the intended design of Vite and the broader JavaScript ecosystem.
-   **It's Declarative:** We declare the existence of our barrels in a standard manifest (`package.json`), which is a stable, public API.
-   **It Delegates Responsibility:** We are no longer responsible for mapping a source file to its final, optimized chunk path. By using a standard package import, we delegate the resolution to Vite's core module resolver, which correctly and automatically handles the mapping to the final pre-bundled chunk.
-   **It's Robust:** It avoids any reliance on Vite's internal, undocumented state (`depsOptimizer.metadata`) or timing, making the solution resilient to future updates.

By framing our dependencies in a way Vite is designed to understand—as legitimate package subpaths—we allow its optimizer to see a single, unified dependency graph. This resolves the request waterfall by generating a single, large chunk for all library client components, achieving the original performance goal in a clean, stable, and maintainable way.
