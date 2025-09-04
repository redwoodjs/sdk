# Dev Server Dependency Optimization

This document outlines the strategy used to optimize third-party dependencies in the development server, addressing performance issues like slow startup and in-browser request waterfalls.

## The Challenge: Excessive Code-Splitting and Request Waterfalls

The core problem was a performance bottleneck in the development server caused by how we communicated with Vite's dependency pre-bundling feature (`optimizeDeps`).

To handle client components that might be internal to a third-party library (and thus not exported from the main entry point), our discovery mechanism provided Vite with a list of *every individual file* containing a `"use client"` directive.

This forced `optimizeDeps` into an inefficient mode. Seeing hundreds of individual files as entry points, its underlying bundler (`esbuild`) would perform extreme code-splitting. It created a multitude of tiny, fragmented chunks to maximize code reuse between all of these "entry points" and their shared dependencies. This led directly to the in-browser request waterfall, where the browser would have to make hundreds of sequential requests to render a single page, causing noticeable lag.

## The Solution: A Standalone Scan with Barrel Generation

The solution works *with* Vite's architecture rather than fighting it. It gives us full control over the discovery process and then communicates the results to Vite in a way that its optimizer is designed to handle. The strategy has three main parts.

### 1. A Standalone `esbuild` Scan

The core of the solution is our own, separate `esbuild` scan that runs before Vite's `optimizeDeps` process begins. This scan traverses the application's entire dependency graph to create a definitive list of all directive-marked modules.

The scanner's most critical feature is its custom, Vite-aware module resolver, which ensures its dependency traversal perfectly mimics the application's actual runtime behavior, correctly handling complex project configurations like TypeScript path aliases.

For a detailed explanation of the scanner's implementation and the rationale behind its design, see the [Directive Scanning and Module Resolution](./directiveScanningAndResolution.md) documentation.

### 2. The "Barrel File" Strategy to Unify the Dependency Graph

Instead of feeding hundreds of individual files to `optimizeDeps`, we consolidate them into a single, virtual **"barrel file."** This file is a module that simply re-exports every discovered directive-marked file.

This approach is superior because it works *with* the bundler's expectations. By providing only a single entry point (the barrel file) to the optimizer, we signal that all the modules within it are part of a single, large, interconnected dependency graph. This allows `esbuild` to create one large, efficient pre-bundled chunk instead of hundreds of small ones, which directly solves the request waterfall problem.

### 3. Synchronized Execution to Solve Timing Issues

The final piece of the puzzle is *how* and *when* to provide this barrel file. A critical challenge is the timing of our scan relative to the `client` and `ssr` optimizers that consume its output. Vite's dev server starts many processes in parallel, creating a potential race condition.

The solution is to **synchronize the scan execution** with Vite's dependency optimization lifecycle using a hybrid blocking strategy.

1.  **Asynchronous Scan Start:** The scan is initiated in the `configureServer` hook but is not awaited, allowing the Vite server to start up quickly.

2.  **Optimizer Blocking:** A custom `esbuild` plugin is injected into `optimizeDeps`. Its `onStart` hook awaits the scan's completion, pausing the optimizer until the barrel files are ready.

3.  **Request Blocking:** A Vite middleware is added to block any incoming browser requests until the scan is complete. This prevents vite from processing _application_ code (Optimizer blocking point above is only for `node_modules` code), until the scan has completed.

This approach balances perceived performance with correctness, ensuring that neither the optimizer nor the browser receives incomplete information. Once the scan completes, we write the barrel file contents to physical files on disk. This is simpler and more reliable than in-memory generation, and the files serve as a cache for subsequent operations.