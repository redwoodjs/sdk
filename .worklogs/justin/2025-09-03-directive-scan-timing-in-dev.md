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

### 7. Attempt #5: Performance Issues with `createIdResolver`

The `optimizer.init` patching strategy successfully solved the timing and race condition issues. However, it revealed a new, blocking problem: the `runDirectivesScan` process, now using `createIdResolver`, became extremely slow, causing a long delay in server startup.

This has prompted a new investigation. The performance issue does not seem to be with `createIdResolver` itself, but potentially with the `worker` environment it's being run against.

The current hypothesis is that the fully initialized `worker` environment, with its complete set of plugins (including our own), is causing a slowdown or recursive loop within the resolver.

To test this, the new strategy is to **run the scan in an isolated, temporary environment**. Instead of passing the live `server.environments.worker`, the `runDirectivesScan` function has been refactored to be self-contained. It now creates its own, temporary Vite `Environment` using the `worker`'s resolved config, but with a fresh, clean plugin container. If the scan is fast in this isolated context, it will confirm that some aspect of the live `worker` environment is the source of the performance problem.

### 8. Attempt #6: Decoupling with `enhanced-resolve`

The investigation into using an isolated environment hit a critical roadblock: Vite bundles its distribution files in a way that makes its internal modules, including the lightweight `ScanEnvironment`, inaccessible. This is a strong signal that relying on internal APIs is not a sustainable path.

This led to a final strategic pivot, abandoning Vite's internal resolution mechanisms in favor of a robust, decoupled approach.

**Options Considered:**

1.  **Create a Stubbed Environment:** We considered creating a mock `Environment` object that would satisfy the API contract for the resolver. This was rejected as it would require re-implementing significant and complex parts of Vite's internal plugin container, making it extremely brittle.
2.  **Adopt `enhanced-resolve`:** We decided to use the `enhanced-resolve` library, the same resolver used by Webpack. This provides a powerful and stable resolver that is independent of Vite's internals.

**Decision and Rationale:**

The decision was made to adopt `enhanced-resolve`. This approach is more robust, as it decouples our scanning process from Vite's internal APIs, protecting it from breaking changes in future Vite versions.

The plan is to replace the simplistic, custom alias resolution logic in `runDirectivesScan.mts` with a new resolver powered by `enhanced-resolve`. This will involve creating a translation layer in a separate, tested module to map the `worker` environment's `resolve` configuration from the Vite config (`alias`, `conditions`, etc.) into the format that `enhanced-resolve` expects.

### 9. Attempt #7: Plugin Compatibility Roadblock

The `enhanced-resolve` implementation successfully handled basic alias resolution and was much more performant than the previous `createIdResolver` approach. However, testing revealed a critical limitation: **plugin compatibility**.

**The Problem:**
Many Vite plugins (such as `vite-tsconfig-paths`) don't add static aliases to the Vite configuration. Instead, they use Vite's `resolveId` hook to dynamically resolve modules at runtime. Our `enhanced-resolve` approach operates at the `esbuild` level and completely bypasses Vite's plugin system, meaning we miss all the dynamic resolution logic that plugins provide.

**Investigation:**
- `vite-tsconfig-paths` parses `tsconfig.json` files and uses the `resolveId` hook to resolve TypeScript path mappings
- Our `esbuild` plugin runs independently of Vite's plugin system and has no access to `this.resolve` or other Vite plugin APIs
- This means projects using TypeScript path mappings or other plugin-based resolution will fail to resolve modules correctly during the directive scan

**Options Considered:**
1. **Hybrid Approach:** Try Vite's resolver first, fallback to `enhanced-resolve` - Not viable because `esbuild` plugins don't have access to Vite's `this.resolve` API
2. **Extract Plugin Logic:** Manually replicate resolution logic from key plugins - Too brittle and maintenance-heavy
3. **Return to `createIdResolver`:** Use Vite's resolver but with better isolation to avoid performance issues

**Decision:**
We will revert to using Vite's `createIdResolver` (Option 3) but with a new strategy to address the performance issues. The plan is to modify our own plugins to skip their hooks when they detect that a directive scan is in progress, reducing the complexity and potential for recursive loops that caused the original slowdown.

## Attempt #8: Plugin Hook Skipping Strategy

**Implementation:**
1. **Scanning State Tracking:** Use `process.env.RWSDK_DIRECTIVE_SCAN_ACTIVE = "true"` to indicate when directive scanning is active
2. **Plugin Hook Modifications:** Add early returns in all our plugin hooks that check for this environment variable
3. **Cleanup:** Always clear the environment variable in a `finally` block to ensure it's reset even if scanning fails

**Modified Plugins:**
- `reactConditionsResolverPlugin` - `resolveId` hook
- `ssrBridgePlugin` - `resolveId` and `load` hooks  
- `manifestPlugin` - `resolveId` and `load` hooks
- `createDirectiveLookupPlugin` - `resolveId` and `load` hooks
- `directivesPlugin` - `transform` hook
- `transformJsxScriptTagsPlugin` - `transform` hook
- `injectVitePreamblePlugin` - `transform` hook
- `virtualPlugin` - `resolveId` and `load` hooks

This approach maintains full Vite plugin compatibility through `createIdResolver` while avoiding the performance bottlenecks that occurred when our plugins were executing during the scan process. The directive scan can now use Vite's robust resolution logic without triggering expensive plugin operations.

## Follow-up Issue: `vite-tsconfig-paths` Resolution

After implementing the plugin hook skipping strategy, the directive scan is working but there's an issue where `vite-tsconfig-paths`' `resolveId` hook doesn't appear to be getting called during the directive scan. This suggests that either:
1. The plugin hook skipping strategy is too aggressive and is preventing third-party plugins from running
2. There's something about how `createIdResolver` works that doesn't trigger all plugin hooks as expected
3. The timing or context of the scan is different from normal Vite resolution

This needs further investigation to ensure TypeScript path mappings are properly resolved during scanning.
