# Work Log: 2025-09-03 - Solving Directive Scan Resolution and Timing

## 1. Problem Definition & Goal

The initial problem was a failure in our custom `esbuild`-based directive scanner (`runDirectivesScan`). This scanner is responsible for discovering `"use client"` and `"use server"` directives by traversing the application's dependency graph.

The scanner's module resolution logic was too simplistic and broke when it encountered a project that used star (`*`) path aliases. This revealed a fundamental flaw in our approach: we were attempting to re-implement complex module resolution logic that Vite already handles perfectly.

The goal therefore shifted from patching our scanner to integrating Vite's own resolution capabilities, and then solving the subsequent timing challenges that this integration revealed.

## 2. Investigation: Finding the Right Tool and the Right Time

The first step was to find a way to leverage Vite's resolver. We investigated Vite's source code and found that while the internal `esbuildDepPlugin` was not exported, a `createIdResolver` function was. This provided access to Vite's powerful, alias-aware resolution logic and became the target for our integration.

However, simply calling `createIdResolver` was not enough. For the resolver to work correctly, it needs the fully initialized `Environment` object. This led to a deeper investigation into the Vite dev server's startup lifecycle to find the correct moment to run our scan: *after* the environments were initialized, but *before* Vite's dependency optimizer (`optimizeDeps`) started. Standard hooks like `configResolved` and `configureServer` proved to run too early.

## 3. Attempt #1: Patching Internal Lifecycle Methods

Since no public hook existed at the right time, the first attempts involved patching Vite's internal methods to inject our scan at the correct point in the lifecycle.

-   **`_initEnvironments`:** The first attempt was to wrap this method on the `ViteDevServer` instance. However, this failed because the `configureServer` hook (where we could get the `server` instance) runs *after* `_initEnvironments` has already been called.
-   **`createEnvironment` and `init`:** The next attempt was to move the patch earlier, into the `config` hook, to wrap the `init` method of the `worker` environment as it was created. This also proved to be unreliable and overly complex, especially when trying to synchronize the results with the `client` and `ssr` optimizers which run in parallel.

## 4. Attempt #2: The "Just-in-Time" Strategy

The fragility of patching internal methods led to a new approach: abandoning patching entirely in favor of a "Just-in-Time" scan. The idea was to run the scan only at the moment its results were first requested by an optimizer.

This was implemented by injecting a custom `esbuild` plugin into the `client` and `ssr` optimizers.
-   An `onResolve` hook would filter for our virtual "barrel file" paths and tag them with a special namespace.
-   An `onLoad` hook, triggered by the namespace, would then execute the directive scan (guarded by a promise to ensure it only ran once) and return the barrel content directly to `esbuild`.

This was a significant improvement as it relied on more stable APIs.

## 5. Attempt #3: The "Dummy File" Refinement

The `onLoad` strategy was further refined to be more compatible with `esbuild`'s file-based nature. Instead of a purely virtual module, we began by writing physical, empty "dummy files" to disk. The `onLoad` hook would then target these physical file paths and replace their empty content with the dynamically generated barrel content after the scan completed.

This approach worked well for resolving aliases but ultimately revealed a deeper timing issue.

## 6. Attemp #4: Pre-Optimization Scan via `optimizer.init` Patching in `configureServer`

The "Just-in-Time" approach, in all its variations, had a fundamental flaw: it executed the scan *during* the `optimizeDeps` process. Further testing revealed that other parts of the Vite ecosystem needed the results of our scan *before* optimization began. The scan was still running too late.

This led to the final and correct solution, which ensures the scan runs before any optimization begins, but after all environments are ready. It revisits the patching strategy, but with a more precise target and at the correct time.

The key insight is that the `configureServer` hook is the earliest point at which the `ViteDevServer` instance is available with its fully initialized environments and their `depOptimizer` instances, but *before* their `init()` methods have been called.

1.  **Use `configureServer`:** This hook provides access to the live `server` instance.
2.  **Intercept `optimizer.init`:** We iterate through the `client` and `ssr` environments on the `server` object and gain access to their respective `optimizer` instances.
3.  **Wrap the `init` Method:** We replace each optimizer's `init` method with our own `async` wrapper.
4.  **Run Scan and Await Completion:** The wrapper first triggers and `await`s our `runDirectivesScan` (guarded by a promise to ensure it only runs once).
5.  **Populate Barrel Files:** Once the scan is complete, the wrapper writes the final barrel content to the physical files on disk.
6.  **Proceed with Original `init`:** Only then is the original `init` method called, allowing `optimizeDeps` to proceed with the correct information now available.

This approach provides the ideal timing by using the `configureServer` hook to inject our logic at the last possible moment before the dependency optimization process begins.

### 7. New Investigation: Performance Issues with `createIdResolver`

The `optimizer.init` patching strategy successfully solved the timing and race condition issues. However, it revealed a new, blocking problem: the `runDirectivesScan` process, now using `createIdResolver`, became extremely slow, causing a long delay in server startup.

This has prompted a new investigation. The performance issue does not seem to be with `createIdResolver` itself, but potentially with the `worker` environment it's being run against.

The current hypothesis is that the fully initialized `worker` environment, with its complete set of plugins (including our own), is causing a slowdown or recursive loop within the resolver.

To test this, the new strategy is to **run the scan in an isolated, temporary environment**. Instead of passing the live `server.environments.worker`, the `runDirectivesScan` function has been refactored to be self-contained. It now creates its own, temporary Vite `Environment` using the `worker`'s resolved config, but with a fresh, clean plugin container. If the scan is fast in this isolated context, it will confirm that some aspect of the live `worker` environment is the source of the performance problem.
