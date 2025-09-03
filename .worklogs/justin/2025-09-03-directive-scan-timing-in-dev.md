# Work Log: 2025-09-03 - Solving Directive Scan Resolution and Timing

## 1. Problem Definition & Goal

The initial problem was a failure in our custom `esbuild`-based directive scanner (`runDirectivesScan`). This scanner is responsible for discovering `"use client"` and `"use server"` directives by traversing the application's dependency graph.

The scanner's module resolution logic was too simplistic and broke when it encountered a project that used star (`*`) path aliases. This revealed a fundamental flaw in our approach: we were attempting to re-implement complex module resolution logic that Vite already handles perfectly.

The goal therefore shifted from patching our scanner to integrating Vite's own resolution capabilities, and then solving the subsequent timing challenges that this integration revealed.

## 2. Investigation: From "How" to "When"

### 2.1. Part 1: Finding the Right Tool

The first step was to find a way to leverage Vite's resolver. We investigated Vite's source code and found:
*   Vite's internal `esbuildDepPlugin` was not exported and could not be used directly.
*   However, Vite *does* export a `createIdResolver` function, which provides access to its powerful, alias-aware resolution logic. This became the target for our integration.

### 2.2. Part 2: Finding the Right Time

Simply calling `createIdResolver` was not enough. This led to a deeper investigation into the Vite dev server's startup lifecycle, revealing a critical timing issue. For the resolver to work correctly, it needs the fully initialized `Environment` object, which contains the complete plugin container and resolved configuration.

Our scan, therefore, had to run *after* the environments were initialized, but *before* Vite's dependency optimizer (`optimizeDeps`) started, so that the results of our scan (the barrel files) could be included in the pre-bundling process.

We explored using Vite's standard plugin hooks:
*   **`configResolved`:** This hook runs too early. The `Environment` objects exist only as configuration and lack the fully initialized plugin containers needed by the resolver.
*   **`configureServer`:** This hook also runs too early. While Vite awaits promises from this hook, it runs *before* Vite's internal `_initEnvironments()` method is called. This meant our scan would finish before the environments were truly ready.

## 3. The Solution: Intercepting Environment Initialization

Since no public hook exists in the small window between environment initialization and dependency scanning, the most precise solution was to intercept the internal process that bridges them.

The chosen strategy is to wrap Vite's internal `_initEnvironments` method on the `ViteDevServer` instance.

1.  **Use `configureServer` to get access:** The `configureServer` hook provides access to the `server` instance.
2.  **Wrap the Internal Method:** We store a reference to the original `server._initEnvironments` method and replace it with our own `async` function.
3.  **Enforce the Correct Order:** Our wrapper function first `await`s the original method, ensuring Vite's environments are fully initialized. Immediately after, it runs our `runDirectivesScan`.

This approach, while relying on an internal API, is a targeted and robust solution. It allows us to inject our logic at the exact moment required, ensuring our scanner uses Vite's own resolver with a fully prepared environment, and that its output is ready for the dependency optimizers. This solves both the original resolution bug and the subsequent timing issue.

## 4. Final Finding & Refined Solution

Further testing revealed that the initial solution of wrapping `_initEnvironments` in the `configureServer` hook was not working. The wrapper was never being called.

A deeper trace of Vite's source code (`packages/vite/src/node/server/index.ts`) provided the definitive answer: the environments are created and fully initialized *before* the `configureServer` hook is ever executed. Our patch was being applied too late, to a method that had already run.

The final, correct solution is to intercept the process even earlier, at the configuration stage. This is accomplished within a single, unified plugin (`directiveModulesDevPlugin`):

1.  **Use the `config` Hook:** This hook runs very early in the startup process, giving us access to the configuration *before* the server and its environments are created.
2.  **Patch `createEnvironment` and `init`:** We patch the creation and initialization process of the `worker` environment. Our wrapper on the `init` method allows us to run our `runDirectivesScan` at the precise moment the worker is ready.
3.  **Signal Completion with a Promise:** After the scan finishes, our wrapper resolves a shared promise (`workerScanComplete`), which acts as a signal to other processes.
4.  **Synchronize via an `esbuild` Plugin:** The core of the solution is addressing the parallel nature of Vite's startup. Vite initializes all environments (`worker`, `client`, `ssr`) and starts their dependency optimizers concurrently. This creates a race condition: the `client` and `ssr` optimizers start before our `worker` scan has finished populating the `clientFiles` set. To solve this, we inject a small `esbuild` plugin into the `client` and `ssr` optimizers. This plugin's `onResolve` hook intercepts our barrel files and `await`s the `workerScanComplete` promise. This effectively pauses their optimization process at the critical moment, forcing them to wait for the worker's signal before proceeding.

This refined approach is surgically precise. It uses the earliest possible hook to orchestrate the scan and a targeted `esbuild` plugin to solve the synchronization problem caused by Vite's parallel startup, all within a single, maintainable plugin.
