# Dev Server Dependency Optimization

This document outlines the strategy used to manage dependencies in the development server, addressing both performance and stability. The primary goal is to provide Vite's dependency optimizer with a complete picture of the application's dependency graph at startup, preventing both inefficient bundling and disruptive re-optimizations during a session.

## The Challenges

There were two distinct but related challenges that needed to be solved to create a stable and performant development environment.

### 1. Performance: Excessive Code-Splitting and Request Waterfalls

The first problem was a performance bottleneck. To handle directive-marked modules (`"use client"`, `"use server"`) that might be internal to a third-party library, our initial discovery mechanism provided Vite's optimizer (`optimizeDeps`) with a list of *every individual file* containing a directive.

This forced `optimizeDeps` into an inefficient mode. Seeing hundreds of individual files as entry points, its underlying bundler (`esbuild`) would perform extreme code-splitting, creating a multitude of tiny, fragmented chunks. This led directly to an in-browser request waterfall, where the browser would have to make hundreds of sequential requests to render a single page, causing noticeable lag.

### 2. Stability: Module State Loss from Re-Optimization

The second, more subtle problem was one of stability. After moving to a more streamlined directive scanning process, a new issue emerged: module-level state would be lost during the development session. This was caused by Vite's dependency re-optimization.

The sequence of events was as follows:
1. The server starts, and the application code is loaded.
2. A request triggers the use of a new, previously undiscovered dependency from within the application's own source code (not `node_modules`).
3. Vite's optimizer detects this new dependency, triggers a "re-optimization" pass, and reloads the worker.
4. This reload creates new instances of all modules, wiping out any module-level state (such as `AsyncLocalStorage` contexts or in-memory caches) and causing application crashes.

This happened because the initial optimization pass was only aware of third-party `node_modules` dependencies; it had no knowledge of the application's internal dependency graph.

## The Solutions

The solution is a two-pronged strategy. First, a proactive dependency scan solves the performance problem and reduces the frequency of re-optimizations. Second, a virtual state module provides true resilience against the state-loss that occurs when a re-optimization is unavoidable.

### Solution 1: Proactive Scanning to Prevent Waterfalls and Reduce Re-Optimizations

The first part of the solution is a unified strategy that proactively scans the *entire* dependency graph—both third-party and application code—and feeds this complete picture to Vite at startup. This solves the performance problem by ensuring all dependencies are discovered before they are needed, eliminating request waterfalls. It also mitigates the stability problem by making re-optimizations much less frequent, as the optimizer has a more complete picture of the graph from the outset.

However, this proactive scan cannot account for dependencies that are truly new, such as when a developer adds an import to a new package or module mid-session. When this happens, a re-optimization is still triggered, which leads to the second part of the solution.

#### 1. A Standalone `esbuild` Scan

The core of this strategy is our own, separate `esbuild` scan that runs before Vite's `optimizeDeps` process begins. This scan traverses the application's entire dependency graph to create a definitive list of all modules.

The scanner's most critical feature is its custom, Vite-aware module resolver, which ensures its dependency traversal perfectly mimics the application's actual runtime behavior, correctly handling complex project configurations like TypeScript path aliases.

For a detailed explanation of the scanner's implementation and the rationale behind its design, see the [Directive Scanning and Module Resolution](./directiveScanningAndResolution.md) documentation.

#### 2. The "Barrel File" Strategy to Inform the Optimizer

Instead of feeding hundreds of individual files to `optimizeDeps`, we consolidate them into **"barrel files."** We create separate barrels for third-party dependencies (which we refer to as **vendor barrels**) and for the application's own source code.

This approach works *with* the bundler's expectations. By providing a small, consolidated list of entry points (the barrel files), we signal a complete and interconnected dependency graph. This allows `esbuild` to perform an efficient, comprehensive optimization pass that avoids both excessive chunking and the need for later re-optimization.

#### 3. Synchronized Execution and Assertive Resolution

A final challenge is the timing and execution of this process within Vite's lifecycle. Vite starts many processes in parallel, creating potential race conditions. Furthermore, Vite's dependency scanner is designed to treat application code as "external" by default, meaning it won't scan it for dependencies.

We solve this with a hybrid blocking and resolution strategy:

1.  **Asynchronous Scan Start:** The scan is initiated early in the `configureServer` hook but is not awaited, allowing the Vite server to start up quickly.

2.  **Optimizer Blocking:** A custom `esbuild` plugin is injected at the *start* of the `optimizeDeps` plugin chain. Its `onResolve` hook intercepts requests for our barrel files and `await`s the scan's completion, pausing the optimizer until the barrels are populated with content.

3.  **Assertive Resolution:** The same `esbuild` plugin intercepts resolution requests for the application's own source files. It then explicitly returns a resolution result, claiming the file and signaling that it is *internal* code that must be scanned for dependencies. This preempts Vite's default behavior and ensures the entire application graph is traversed.

### Solution 2: A Virtual State Module for Resilient State

To solve the module state loss problem definitively, the framework introduces a centralized, virtual state module that is insulated from Vite's re-optimization process. This module, identified by the specifier `rwsdk/__state`, acts as the single, persistent source of truth for all critical framework-level state.

A dedicated Vite plugin is responsible for managing this module. Its primary job is to mark `rwsdk/__state` as "external" to Vite's dependency optimizer for the `worker` environment. This simple but critical step prevents the state module from being included in the dependency graph that Vite reloads. When a re-optimization occurs, all other application and framework modules are re-instantiated, but the virtual state module remains untouched, preserving its state across the reload.

This approach directly solves the state-loss problem, making features that rely on module-level state (like `AsyncLocalStorage` for request context) resilient to dependency changes during development. It also encourages a more organized approach to state management within the framework by providing a central, explicit location for all shared state.