# Dev Server Dependency Optimization

This document outlines the strategy used to optimize third-party dependencies in the development server, addressing performance issues like slow startup and in-browser request waterfalls.

## The Challenge: Excessive Code-Splitting and Request Waterfalls

The core problem was a performance bottleneck in the development server caused by how we communicated with Vite's dependency pre-bundling feature (`optimizeDeps`).

To handle client components that might be internal to a third-party library (and thus not exported from the main entry point), our discovery mechanism provided Vite with a list of *every individual file* containing a `"use client"` directive.

This forced `optimizeDeps` into an inefficient mode. Seeing hundreds of individual files as entry points, its underlying bundler (`esbuild`) would perform extreme code-splitting. It created a multitude of tiny, fragmented chunks to maximize code reuse between all of these "entry points" and their shared dependencies. This led directly to the in-browser request waterfall, where the browser would have to make hundreds of sequential requests to render a single page, causing noticeable lag.

## The Solution: A Standalone Scan Paired with a "Barrel File"

The final, robust solution works *with* Vite's architecture rather than fighting it. It gives us full control over the discovery process and then communicates the results to Vite using standard, public APIs. The strategy has two main parts.

### 1. A Standalone `esbuild` Scan (Pre-Optimization)

Before Vite's `optimizeDeps` process begins, we run our own, separate `esbuild` scan.
-   **Exhaustive Discovery:** This scan starts from the application's entry points and traverses the entire dependency graph. It uses a custom `esbuild` plugin—internal to our scanning process—that reads the content of every resolved module and checks for `"use client"` or `"use server"` directives, populating a complete and accurate list of all directive-marked files.
-   **Configuration-Aware:** The scanner's key feature is its use of Vite's own internal module resolver (`createIdResolver`). By passing it the application's final, resolved Vite configuration, we ensure its module resolution perfectly mimics the application's runtime behavior, making the scan both accurate and reliable.

With this scan complete, we have a definitive list of all client components *before* Vite's optimizer begins its work.

### 2. "Barrel as a Package Subpath"

The second part of the solution addresses how we communicate this list to Vite's optimizer. Instead of feeding it hundreds of individual entry points, we consolidate them.

1.  **Generate a Physical Barrel File:** We generate a physical "barrel" file on disk (e.g., `__client_barrel.js`) containing an `export * from '...'` statement for every discovered client component from `node_modules`.
2.  **Declare as a Package Subpath:** We add this barrel file to our `sdk/package.json` under the `"exports"` map. This elevates our barrel file from a simple file to an official, resolvable part of our `rwsdk` package (e.g., `rwsdk/__client_barrel`).
3.  **Inform the Optimizer:** We then add this single package subpath to the `optimizeDeps.include` array in Vite's configuration.

### Rationale: Aligning with the Ecosystem

This approach is superior because it works *with* the bundler's expectations.

-   **It's Declarative:** We declare the existence of our barrel in a standard manifest (`package.json`), which is a stable, public API.
-   **It Creates a Unified Graph:** By providing only a single entry point (the barrel file) to the optimizer, we signal that all the modules within it are part of a single, large, interconnected dependency graph. This allows `esbuild` to create one large, efficient pre-bundled chunk instead of hundreds of small ones.
-   **It Delegates Responsibility:** We are no longer responsible for mapping a source file to its final, optimized chunk path. By using a standard package import, we delegate the resolution to Vite's core module resolver, which correctly and automatically handles the mapping to the final pre-bundled chunk.

By framing our dependencies in a way Vite is designed to understand, we resolve the request waterfall and achieve the original performance goal in a clean, stable, and maintainable way.

### 3. Solving the Inter-Environment Race Condition

A critical challenge in this process is the timing of the standalone scan relative to the `client` and `ssr` optimizers that consume its output.

**The Problem: Parallel Optimization**

Vite's dev server is designed for efficiency and initializes all environments (`worker`, `client`, `ssr`) in parallel. This means their `optimizeDeps` processes also kick off concurrently. This creates a natural race condition: our standalone scan, which is triggered by the `worker` environment's initialization, is still running when the `client` and `ssr` optimizers start. Consequently, the `client` and `ssr` optimizers attempt to process our barrel files *before* the scan has finished populating them with content, leading to a failed optimization.

**The Solution: A Two-Part Synchronization Strategy**

We solve this race condition using a single plugin (`directiveModulesDevPlugin`) that employs a two-part strategy based on patching Vite's startup process:

1.  **Orchestration (in the `config` hook):** We use the very early `config` hook to patch the `createEnvironment` and `init` methods of the `worker` environment. This allows us to run our standalone scan at the exact moment the `worker` is initialized. Upon completion, the scan resolves a shared promise, which acts as a signal.

2.  **Synchronization (via an `esbuild` plugin):** In the same `config` hook, we inject a custom `esbuild` plugin into the `optimizeDeps` configuration for the `client` and `ssr` environments. This plugin has an `onResolve` hook that intercepts requests for our barrel files. The hook's only job is to `await` the shared promise from the worker scan. This effectively pauses the `client` and `ssr` optimizers at the critical moment, forcing them to wait until the `worker` scan is complete before they proceed.

This strategy, while complex, creates a reliable causal chain. It allows Vite to retain its parallel startup for general efficiency but creates a targeted, synchronous dependency for our specific barrel files, ensuring the entire process completes in the correct order.
