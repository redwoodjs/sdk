# Dev Server Dependency Optimization

This document outlines the strategy used to optimize third-party dependencies in the development server, addressing performance issues like slow startup and in-browser request waterfalls.

## The Challenge: Excessive Code-Splitting and Request Waterfalls

The core problem was a performance bottleneck in the development server caused by how we communicated with Vite's dependency pre-bundling feature (`optimizeDeps`).

To handle client components that might be internal to a third-party library (and thus not exported from the main entry point), our discovery mechanism provided Vite with a list of *every individual file* containing a `"use client"` directive.

This forced `optimizeDeps` into an inefficient mode. Seeing hundreds of individual files as entry points, its underlying bundler (`esbuild`) would perform extreme code-splitting. It created a multitude of tiny, fragmented chunks to maximize code reuse between all of these "entry points" and their shared dependencies. This led directly to the in-browser request waterfall, where the browser would have to make hundreds of sequential requests to render a single page, causing noticeable lag.

## The Solution: A Standalone Scan with "Just-in-Time" Barrel Generation

The final, robust solution works *with* Vite's architecture rather than fighting it. It gives us full control over the discovery process and then communicates the results to Vite in a way that its optimizer is designed to handle. The strategy has three main parts.

### 1. A Standalone `esbuild` Scan

The core of the solution is our own, separate `esbuild` scan.
-   **Configuration-Aware Resolution:** The scanner's key feature is its use of Vite's own internal module resolver (`createIdResolver`). By passing it the application's final, resolved Vite configuration, we ensure its module resolution perfectly mimics the application's runtime behavior, making the scan both accurate and reliable.
-   **Exhaustive Discovery:** This scan starts from the application's entry points and traverses the entire dependency graph. It uses a custom `esbuild` plugin—internal to our scanning process—that reads the content of every resolved module and checks for `"use client"` or `"use server"` directives, populating a complete and accurate list of all directive-marked files.

With this scan complete, we have a definitive list of all directive-marked files. The next challenge is how to communicate this list to Vite's optimizer.

### 2. The "Barrel File" Strategy to Unify the Dependency Graph

Instead of feeding hundreds of individual files to `optimizeDeps`, we consolidate them into a single, virtual **"barrel file."** This file is a module that simply re-exports every discovered directive-marked file.

This approach is superior because it works *with* the bundler's expectations. By providing only a single entry point (the barrel file) to the optimizer, we signal that all the modules within it are part of a single, large, interconnected dependency graph. This allows `esbuild` to create one large, efficient pre-bundled chunk instead of hundreds of small ones, which directly solves the request waterfall problem.

### 3. Synchronized Execution to Solve Timing Issues

The final piece of the puzzle is *how* and *when* to provide this barrel file. A critical challenge is the timing of our scan relative to the `client` and `ssr` optimizers that consume its output. Vite's dev server starts all processes in parallel, creating a race condition.

The solution is to **synchronize the scan execution** with Vite's dependency optimization lifecycle by patching the optimizer's initialization method.

1.  **Patch `optimizer.init`:** During Vite's `configResolved` hook, we patch the `init` method of the `client` and `ssr` environment optimizers. This ensures our directive scan runs *before* any dependency optimization begins.

2.  **Plugin Hook Skipping for Performance:** To address performance issues when using Vite's `createIdResolver` during scanning, we implement a plugin hook skipping strategy:
    -   **Scanning State Tracking:** Set `process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE = "true"` during scan execution
    -   **Early Returns:** All our plugin hooks (`resolveId`, `load`, `transform`) check for this environment variable and return early to avoid expensive operations during scanning
    -   **Cleanup:** Always clear the environment variable in a `finally` block

3.  **Physical Barrel Files:** Once the scan completes, we write the barrel file contents to physical files on disk. This approach is simpler and more reliable than in-memory generation, and the files serve as a cache for subsequent operations.