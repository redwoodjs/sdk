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

### 3. "Just-in-Time" Generation to Solve Timing Issues

The final piece of the puzzle is *how* and *when* to provide this barrel file. A critical challenge is the timing of our scan relative to the `client` and `ssr` optimizers that consume its output. Vite's dev server starts all processes in parallel, creating a race condition.

Instead of trying to patch Vite's startup lifecycle, the solution is a **"Just-in-Time"** strategy that generates the barrel file at the exact moment it's first needed.

1.  **Inject a Trigger Plugin:** We inject a custom `esbuild` plugin into the `optimizeDeps` configuration for the `client` and `ssr` environments. This plugin uses a pair of hooks to manage the process:
    -   **`onResolve`:** A targeted hook filters *only* for our virtual barrel file paths (e.g., `rwsdk/__client_barrel`). Its only job is to tag these paths with a special namespace (e.g., `"rwsdk-barrel"`). This signals `esbuild` that these are not normal files and should be handled by our `onLoad` hook.
    -   **`onLoad`:** This hook is configured to fire only for modules tagged with our `"rwsdk-barrel"` namespace.

2.  **Run the Scan on Demand:** The *first time* the `onLoad` hook is triggered, it has access to the now-fully-initialized `ViteDevServer` instance and its environments. It then executes our `runDirectivesScan`. A promise ensures the scan is only ever run once.

3.  **Generate Content In-Memory:** Once the scan is complete, the `onLoad` hook generates the appropriate barrel file content in memory and returns it directly to `esbuild` via the `contents` property. This completely bypasses the filesystem.