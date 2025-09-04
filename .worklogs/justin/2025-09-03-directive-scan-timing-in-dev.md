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

## 10. Reconciling `createIdResolver` and Plugin Compatibility

The "Plugin Hook Skipping" strategy was successful in solving the performance issue, but it surfaced a deeper, more subtle problem. While testing, it became clear that the scanner was still failing to resolve modules handled by other Vite plugins, most notably `vite-tsconfig-paths`. This meant that although our own plugins were no longer interfering with the scan, third-party plugins were not participating in it either.

An investigation into Vite's source code revealed the root cause: the `createIdResolver` function we were using is intentionally minimal. It creates its own isolated plugin container that includes only Vite's internal `alias` and `resolve` plugins. This is fundamentally different from Vite's `optimizeDeps` scanner, which uses the environment's main `pluginContainer` and therefore has access to the full suite of user-provided plugins. This explained everything: our scan was fast but incomplete because it was completely blind to the plugin ecosystem.

### Attempt #9: The Hybrid Approach and its Inconsistency

The immediate next step was a hybrid approach: in dev mode, where the full `environment.pluginContainer` is available, we would use its `resolveId` method. In build mode, where it is not, we would fall back to `createIdResolver`.

This worked perfectly in the dev server, immediately solving the `vite-tsconfig-paths` issue. However, it introduced an unacceptable inconsistency. The directive scan would behave differently in dev versus build, meaning a project could work perfectly for a developer but fail during the production build. A consistent and reliable scan across both modes was essential.

### Attempt #10: The Internal API Dead End

To solve this inconsistency, the next idea was to make the build environment behave like the dev environment. We had observed that `BuildEnvironment` instances do resolve the full list of plugins (available on `environment.plugins`), they just don't create a `pluginContainer` for them. The plan was to manually create one ourselves by calling Vite's internal `createEnvironmentPluginContainer` function.

This strategy failed because Vite's public API does not expose the necessary functions. While they exist within Vite's bundled distribution files, accessing them would require importing from a hashed internal chunk file (e.g., `dep-DBxKXgDP.js`). Since this hash changes with every Vite release, this path was rejected as being far too brittle and unsustainable.

### Attempt #11: Synthesizing a Solution with `enhanced-resolve`

The realization that Vite's internal APIs were not a viable option led back to a previous idea, but with a new insight. We had previously abandoned `enhanced-resolve` because it bypassed the Vite plugin system. The new approach was to synthesize these two concepts: use `enhanced-resolve` as the core resolver, but extend it to be aware of the Vite plugin ecosystem.

This was achieved by leveraging `enhanced-resolve`'s own robust plugin system. A custom `enhanced-resolve` plugin, the `VitePluginResolverPlugin`, was created. This plugin hooks into the `enhanced-resolve` pipeline and, if the core resolver cannot find a module, it then iterates through the Vite plugins on the current `environment` and calls their `resolveId` hooks.

This approach provides the best of all worlds. It uses the fast, powerful `enhanced-resolve` library as its foundation while seamlessly integrating the dynamic, plugin-based resolution that makes Vite so flexible. Most importantly, it relies only on stable, public APIs (`environment.plugins` and the `enhanced-resolve` plugin interface), resulting in a consistent, maintainable, and robust solution that works identically across both dev and build environments.

## 12. Debugging Plugin Integration Issues

The implementation of the `VitePluginResolverPlugin` initially encountered several technical challenges that required investigation and refinement:

**TypeError: `plugin.resolveId.call is not a function`**
Multiple Vite plugins were failing with this error because the plugin system needed to handle different `resolveId` hook formats. Some plugins define `resolveId` as a direct function, while others use an object format with a `handler` property. The solution was to add type checking to handle both formats correctly.

**JavaScript heap out of memory**
A circular dependency was discovered when Vite plugins called `this.resolve()` within their `resolveId` hooks. Since our `VitePluginResolverPlugin` was part of the main resolver, this created an infinite loop. The fix involved creating a separate `baseResolver` instance without our plugin for the plugin context's `resolve` method.

## 13. Debugging the `vite-tsconfig-paths` Integration

With the `VitePluginResolverPlugin` in place, the architecture was designed to support plugins like `vite-tsconfig-paths` that perform dynamic resolution. However, testing on an application using `@/*` aliases exposed a flaw in the integration.

The problem was a breakdown in the execution: our plugin was not correctly handling the results (or lack thereof) from `vite-tsconfig-paths`.

**The Resolution Process & Failure Point:**
1.  `vite-tsconfig-paths` receives a request for `@/app/Document`.
2.  It correctly maps the alias to a file path without an extension (e.g., `/path/to/src/app/Document`).
3.  It then calls the `resolve` function provided by our plugin's context to find the actual file.
4.  Our context resolver, powered by `enhanced-resolve`, successfully finds the file by trying different extensions (e.g., `/path/to/src/app/Document.tsx`).
5.  **Failure Point:** Despite our resolver finding the correct file, `vite-tsconfig-paths` was not returning this successfully resolved path. It returned `undefined`, causing the overall resolution to fail.

**Current Status:**
The investigation confirmed that our `baseResolver` within the plugin context is functioning correctly. The focus has now shifted to understanding why `vite-tsconfig-paths` is discarding the valid, resolved path it receives from our context resolver. This suggests an issue with how the async result is handled or a potential mismatch in the expected return format between our resolver and the plugin.

## 14. Fixing the Plugin Context Return Value

A close examination of the `vite-tsconfig-paths` source code provided the solution. The plugin's `resolveId` hook calls `this.resolve()` (our context resolver) and expects the return value to be an object with an `id` property, matching the standard Vite `ResolveIdResult` object: `{ id: string }`.

Our implementation was incorrectly returning a `string` directly. This mismatch caused `vite-tsconfig-paths` to receive `undefined` for the `id` and discard the otherwise successful resolution.

**The Fix:**
The `resolve` function within our `pluginContext` was modified to wrap the successful result string in an object, changing the return signature from `Promise<string | null>` to `Promise<{ id: string } | null>`.

**Outcome:**
This change immediately fixed the integration. The logs now show `vite-tsconfig-paths` receiving the correctly formatted result object and successfully resolving all `@/*` aliases.

This resolved the alias issue, allowing the directive scan to proceed further, but uncovered a new, unrelated error: "No matching export in '...' for import 'defineApp'". This indicates the next phase of debugging will shift from module resolution to the content and bundling of the worker entry file itself.

## Attempt #12: Aligning with Vite's Resolution Strategy

While the previous fix of skipping plugins for relative imports worked, it was identified as a workaround rather than a fundamental solution. A deeper analysis of Vite's own practices revealed a more robust and correct approach to handling different module types.

**The Investigation:**
The core insight came from observing that Vite itself does not simply skip its plugin system for relative paths. Instead, it ensures paths are normalized and absolutified *before* they enter the main plugin pipeline. This prevents plugins from having to interpret relative paths, which was the root cause of the `vite-plugin-cloudflare` issue. The plugin was incorrectly applying package export conditions to a relative intra-package import because it wasn't an absolute file path.

**The Refined Solution:**
The implementation was refactored to align with this "absolutify-first" strategy.

1.  **Detect Relative Imports:** The `VitePluginResolverPlugin` first checks if a request is relative (`../` or `./`).
2.  **Resolve to Absolute Path:** If it is, the plugin uses `enhanced-resolve`'s own base resolver to convert the relative path into an absolute file path. This lets `enhanced-resolve` handle the file-system-level resolution it excels at.
3.  **Process Plugins with Absolute Path:** The resulting absolute path is then sent through the Vite plugin pipeline. This allows plugins like `vite-plugin-cloudflare` to operate correctly, as they are now processing a standard absolute file path and won't incorrectly apply package export logic.
4.  **Process Non-Relative Imports Directly:** All other imports (bare module specifiers, aliases) are passed through the Vite plugin pipeline as before.

**Outcome:**
This approach is more robust and less prone to edge cases than simply skipping the plugin system. It correctly delineates responsibilities: `enhanced-resolve` handles file system path resolution, and the Vite plugins handle transformations and special resolution logic on a predictable, normalized path. This solved the circular dependency and `defineApp` export error in a more fundamental way, leading to a successful and reliable build.


### Attempt #13: A Pragmatic Retreat to Blocking and Optimization

After achieving a working directive scan, performance analysis on a large project revealed that the scan could take 5-6 seconds, blocking Vite's `optimizeDeps` process and delaying server startup.

An attempt was made to run the scan in the background and intercept Vite's internal `scanProcessing` promise to avoid blocking, but this approach proved to be fraught with complexity. The core issue is that many parts of Vite's startup process depend on the results of dependency scanning, and trying to work around this adds fragility. The risk of introducing subtle race conditions was high, and the maintenance burden of tracking Vite's internal APIs was not worth the perceived performance gain.

**Decision:**
The most pragmatic solution is to accept that the directive scan is a necessary, blocking step in the startup process. Instead of hiding the work with complex machinery, the focus will shift to:
1.  **Transparency:** Clearly inform the user that the scan is running so the delay is understandable.
2.  **Optimization:** Make the scan itself as fast as possible to minimize the blocking time.

**The New Plan:**
1.  **Add Logging:** User-facing `console.log` messages will be added to the start and end of the `runDirectivesScan` function. This will provide clear feedback during both `dev` and `build`.
2.  **Optimize Resolution:** The Vite-aware resolver will be optimized. It will first attempt to resolve modules using a standard `enhanced-resolve` configuration. Only if this fast path fails will it proceed to the more expensive step of iterating through the full Vite plugin chain. The assumption is that the majority of resolutions would be the same if enhance-resolve did them, or if the vite plugin chain did them.

### Attempt #14: A Hybrid Blocking Strategy for Perceived Performance

While accepting the scan as a blocking step was the correct decision for stability, further iteration revealed a way to improve the user's perceived startup time without re-introducing complexity or race conditions. The solution is a hybrid blocking approach that starts the scan asynchronously but blocks the specific Vite processes that depend on its output.

This allows the Vite server itself to initialize quickly, while ensuring correctness.

**The Implementation:**

1.  **Asynchronous Scan Start:** In the `configureServer` hook, the directive scan is initiated, but not awaited. This allows the hook to complete and Vite's server startup to proceed without being blocked.

2.  **Optimizer Blocking:** A custom `esbuild` plugin is injected into the `optimizeDeps` configuration for the `client` and `ssr` environments. This plugin's `onStart` hook awaits the scan promise, effectively pausing the dependency optimization process until the barrel files are ready. This is the critical step that prevents `optimizeDeps` from running with incomplete information.

3.  **Request Middleware Blocking:** A Vite middleware is added that also awaits the scan promise. This blocks any incoming browser requests for application code from being served until the scan is complete. This prevents vite from processing _application_ code (Optimizer blocking point above is only for `node_modules` code), until the scan has completed.

**Outcome:**
This approach strikes an effective balance between performance and simplicity. The dev server feels more responsive because its initial startup is not blocked. At the same time, the two blocking mechanisms ensure that neither the dependency optimizer nor the browser receives incomplete information, preserving the stability of the previous blocking approach without the significant startup delay.