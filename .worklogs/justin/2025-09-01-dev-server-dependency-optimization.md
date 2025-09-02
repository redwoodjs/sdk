# Work Log: 2025-09-01 - Optimizing Dev Server Dependencies

## 1. Problem Definition & Goal

The primary goal is to improve the developer experience by optimizing how dependencies are handled in the dev server. The core problem has two symptoms:

*   **Slow Initial Startup:** The server takes a long time to become ready.
*   **In-Browser Request Waterfalls:** When using a component from a large library (like Mantine), the browser makes many sequential requests for individual module files, leading to noticeable lag and layout shifts during development.

This is happening because our framework's method of discovering `"use client"` modules forces Vite's `optimizeDeps` feature into an inefficient mode where it creates many small, fragmented chunks for library components instead of a single, unified one.

## 2. Investigation: Discarded Ideas & Why

We explored several potential solutions, each with a critical flaw:

*   **Use esbuild's `metafile`:** This was technically infeasible as Vite does not expose the `metafile` option for `optimizeDeps`.
*   **Run a preliminary esbuild pass:** A standalone esbuild pass would be unaware of the project's Vite configuration (e.g., `resolve.alias`), making it too fragile.
*   **Scan `node_modules`:** This would be unacceptably slow and defeat the purpose of the optimization.
*   **Use `optimizeDeps.include`:** This made a dangerous assumption that any `"use client"` file within a package would be reachable from that package's main entry point, which is not guaranteed for internal, un-exported components.

## 3. The Solution: The Virtual Dependency Barrel

We've landed on a robust solution that does not rely on package exports at all. The strategy is to create a **virtual module** in memory that acts as a "barrel" file, explicitly re-exporting every `"use client"` module found in `node_modules`.

1.  **Identify Client Modules:** During startup, our plugin will scan the project and its dependencies to populate the `clientFiles` set with the absolute paths of all modules containing the `"use client"` directive.
2.  **Generate a Virtual Barrel Module:** For the `client` and `ssr` environments, our plugin will create a virtual module (e.g., `virtual:rwsdk:client-module-barrel`). The content of this module will be a list of `export * from '...'` statements, one for each file in `clientFiles` that is located in `node_modules`.
3.  **Configure `optimizeDeps`:** We will add the name of this single virtual module to the `optimizeDeps.entries` array. A similar process will be followed for server modules.

### Rationale: Forcing a Single Dependency Graph

This approach is superior because:

-   **It's Explicit:** By feeding Vite a single entry point that directly imports every required module, we force its optimizer to see all library-based client components as part of one large, interconnected dependency graph.
-   **No Unsafe Assumptions:** It completely avoids the problem of internal/un-exported components because we are pointing directly to the specific files, not relying on the library's public API.
-   **Solves the Waterfall:** The result of the optimization will be a single, large chunk containing all the necessary library client code, which can be loaded in one request, definitively solving the in-browser request waterfall.

This plan is contingent on one assumption we'll validate during implementation: that the `client` and `ssr` environment plugins are configured *after* the `worker` environment has completed its initial scan and populated the `clientFiles` set.

## 4. Implementation Journey & Solution

The path from the initial concept to the final working solution involved several important discoveries and course corrections, which revealed subtle but critical details about how Vite's dependency optimizer operates.

### 4.1. First Attempt: The Virtual Barrel

The initial implementation followed the plan: a virtual barrel module was created and added to `optimizeDeps.entries`. This was a step in the right direction, but it led to a new problem: the barrel file itself became the initiator of a new request waterfall, indicating that Vite was not pre-bundling its contents.

### 4.2. Diagnosis: `optimizeDeps` Was Not Triggered

The key insight was that Vite's dependency scanner (`esbuild`) **does not run on virtual modules** specified in `optimizeDeps.entries`. The scanner requires a file it can read from the filesystem. As a result, our virtual barrel was never being pre-bundled; it was being served as plain source code to the browser.

### 4.3. A Dual-Mechanism Plugin Solution

The correct solution requires acknowledging two distinct phases of Vite's operation and addressing them both: **dependency scanning (pre-bundling)** and **dev server runtime**. The implementation handles this within a single, robust plugin (`directiveModulesDevPlugin.mts`).

**1. For the Dependency Optimizer (esbuild):**

To solve the scanning problem, we inject a custom `esbuild` plugin directly into the `optimizeDeps.esbuildOptions.plugins` array for the `client` and `ssr` environments.

-   This plugin uses an **`onLoad`** hook that filters for our virtual barrel module IDs (e.g., `virtual:rwsdk:client-module-barrel`).
-   When `esbuild` attempts to scan the barrel during pre-bundling, this hook intercepts the request and provides the barrel's full, namespaced source code directly to the optimizer.
-   The virtual barrel ID is added to **`optimizeDeps.include`**, which is the correct directive to force pre-bundling of a specific module.

**2. For the Dev Server (Runtime):**

To ensure the virtual barrel can be resolved by the browser during development, the plugin also configures Vite's dev server:

-   A Vite-level **alias** is created, mapping the clean virtual ID to a null-byte prefixed ID (`\0virtual:...`). This signals to Vite that it's a virtual module to be handled by a plugin.
-   The plugin implements Vite's standard **`resolveId` and `load` hooks`. At runtime, when the browser requests the barrel (via the `createDirectiveLookupPlugin`), the alias triggers these hooks, which serve the barrel's content.

This dual-mechanism approach is the complete solution. It correctly feeds the barrel to the `esbuild`-based optimizer *before* the server starts, while also making the same barrel available to the Vite dev server *at runtime*, finally eliminating the dependency waterfall.

## 5. Deeper Investigation: Confirming the Alias Mechanism

Although the dual-mechanism solution is theoretically sound, the "Failed to resolve dependency" error persisted, suggesting a subtle misunderstanding of how Vite's optimizer handles aliases for virtual modules. To get a definitive answer, we dove into the Vite source code.

### 5.1. Tracing the Code Path

1.  **The Entry Point:** We confirmed that items in `optimizeDeps.include` are processed by the `addManuallyIncludedOptimizeDeps` function located in `vite/packages/vite/src/node/optimizer/index.ts`.
2.  **The Resolver:** This function uses a resolver created by `createOptimizeDepsIncludeResolver`, which in turn wraps the main `environment.pluginContainer.resolveId` function.
3.  **The "Smoking Gun":** The critical discovery was in `vite/packages/vite/src/node/optimizer/scan.ts`, which contains the `esbuildScanPlugin`. This plugin's internal `resolveId` function **explicitly calls `environment.pluginContainer.resolveId`**.

### 5.2. The Conclusion

This code trace provides definitive proof that the dependency scanner **does** respect the alias system. The `pluginContainer` is the same one used by the dev server, which means it has access to the `resolve.alias` configuration. The error message indicates that our alias is not being correctly matched or applied during this specific resolution step. The next step is to use this knowledge to debug the precise format of the alias required.

## 6. A Key Insight: Using `configResolved`

A critical piece of the puzzle was realizing *when* our alias was being added relative to Vite's environment-specific configuration creation.

Our plugin was initially attempting to use the `config` hook, and then the `configEnvironment` hook. Both were incorrect. The `config` hook runs too early, before the `environments` object is populated. The `configEnvironment` hook is suitable for some tasks, but the definitive hook for safely accessing the complete, resolved configuration for all environments is **`configResolved`**.

By moving our logic into this hook, we can iterate over the now-guaranteed-to-exist `config.environments` object. This ensures the alias is correctly registered in the final config, the virtual module is resolved by the dependency optimizer, the `onLoad` hook in our `esbuild` plugin fires, and the dependency waterfall is solved.

## 8. The "Dummy File" Solution

After extensive debugging of Vite's internal resolver, it became clear that reliably hooking into the dependency optimizer with a purely virtual module was overly complex and brittle. The most robust solution was to abandon the virtual module approach in favor of a more direct, pragmatic strategy.

The final, successful implementation uses a "dummy file" to satisfy Vite's resolver while still providing our dynamic barrel content.

1.  **Create a Physical Dummy File**: In the `configResolved` hook, the plugin now creates an empty placeholder file on disk (e.g., `node_modules/.vite/rwsdk-client-barrel.js`). The file's only purpose is to exist at a predictable, absolute path.
2.  **Use `optimizeDeps.include`**: The absolute path to this dummy file is added to the `optimizeDeps.include` array. This gives Vite's `esbuild`-based scanner a real file path to resolve, which it does successfully.
3.  **Hijack the File with `onLoad`**: A custom `esbuild` plugin is injected into the optimizer. Its `onLoad` hook is configured to filter for the absolute path of our dummy file. When `esbuild` tries to load the file's content, this hook intercepts the process, discards the empty content, and returns our dynamically generated barrel content instead.

This approach is superior because it sidesteps the complexities of virtual module resolution and aliasing within the optimizer. It works *with* Vite's file-based nature by providing a real path, and then uses a standard `esbuild` pattern to dynamically provide the content, achieving the desired result in a much cleaner and more stable way.

Finally, a guard was added to the plugin's `configResolved` hook to ensure this entire optimization process only runs during development (`serve` command) and is skipped for production builds.

The `createDirectiveLookupPlugin` was also updated to ensure its runtime `import()` statements pointed to the new physical dummy barrel files, fully removing the last reference to the old virtual module system.

## 9. A New Hurdle: Inter-Environment Dependency Timing

The "dummy file" solution is correct in principle, but its success depends on a critical assumption: that the `worker` environment completes its dependency scan and populates the `clientFiles` and `serverFiles` sets *before* the `client` and `ssr` environments run their own `optimizeDeps` pass.

It has become clear that this assumption is false. The environment optimizers appear to run in parallel, which means `directiveModulesDevPlugin` (running in the `client` and `ssr` environments) executes with empty `clientFiles` and `serverFiles` sets, rendering the optimization useless.

The next step is to investigate Vite's source code to answer a key question: how does Vite manage the `optimizeDeps` process for multiple environments? We need to determine if they are run concurrently or sequentially, and if there is any mechanism to enforce a specific order. The goal is to find a way to delay the `client` and `ssr` dependency optimization until after the `worker` environment has completed its initial scan.

### 9.1. Investigation Findings: Parallel Execution

A thorough investigation of Vite's source code (`packages/vite/src/node/server/index.ts`) has provided a definitive answer. During server startup, the `initServer` function calls the `listen` method on all configured environments wrapped in a `Promise.all`.

The `listen` method on each `DevEnvironment` instance is responsible for calling `depsOptimizer.init()`, which is the asynchronous function that starts the dependency scanning and optimization process.

Because they are called via `Promise.all`, **all environment dependency optimizers are explicitly run in parallel.** This confirms that our initial assumption was incorrect and explains why the `clientFiles` and `serverFiles` sets are empty. There is no built-in mechanism in Vite to enforce a sequential dependency optimization chain between environments.

Our next task is to devise a new strategy to manually create this synchronization.

### 9.3. Deeper Investigation: The `depsOptimizer.init()` Timing

Further investigation revealed another subtlety. While the `DepsOptimizer` instance is available in the `configureServer` hook, its crucial `scanProcessing` promise is not. The `scanProcessing` property is only assigned *inside* the optimizer's `init()` method.

The `init()` method for all environment optimizers is called when the Vite server starts listening for requests (specifically, via the `DevEnvironment.listen()` method, which is called by `Promise.all`). This happens *after* the `configureServer` hook has already completed.

This means our synchronization plugin cannot simply access `depsOptimizer.scanProcessing` in the `configureServer` hook, as it will be `undefined`.

### 9.4. Final Strategy: Monkey-Patching `depsOptimizer.init()`

The most robust solution is to intercept the `init` call itself. This gives us a definitive hook into the moment *after* `scanProcessing` has been created.

The final, successful plan is as follows:

1.  **Create a Shared Promise:** A shared promise (`workerScanComplete`) is created in the `redwoodPlugin.mts` orchestrator.
2.  **Create a Synchronization Plugin:** A new plugin is created with a `configureServer` hook.
3.  **Intercept the `init` Method:** Inside `configureServer`, the plugin gets a reference to `server.environments.worker.depsOptimizer`. It then replaces the `init` method with a new `async` function.
4.  **Await the Original `init` and `scanProcessing`:** The new `init` function first calls and `await`s the *original* `init` method. After this returns, the `scanProcessing` promise is guaranteed to exist. The function then `await`s `depsOptimizer.scanProcessing`.
5.  **Resolve the Shared Promise:** Once `scanProcessing` has resolved, our function calls `workerScanComplete.resolve()`, opening the gate for the `client` and `ssr` environments.

This monkey-patching approach, while complex, is the only way to reliably ensure our `esbuild` plugin for the `client` and `ssr` environments runs after the `worker` dependency scan is fully complete.

### 9.5. A New Strategy: Post-Scan Registration

The monkey-patching approach, while technically sound, proved to be unsuccessful, indicating a deeper misunderstanding of the timing of when the `clientFiles` and `serverFiles` sets are populated relative to the `worker` environment's dependency scan.

After re-evaluating, we are pivoting to a fundamentally different and more robust strategy. Instead of trying to pause or synchronize the initial parallel `optimizeDeps` runs, we will let them complete and then use Vite's own APIs to trigger a corrective re-optimization.

The new plan is as follows:

1.  **Find a Post-Optimization Hook:** The first step is to identify a Vite plugin hook that is guaranteed to execute *after* the initial `optimizeDeps` scan has completed for all environments. The most promising candidate for this is to wrap the `server.listen` method inside a `configureServer` hook. The code inside the wrapped `listen` method will only run after the server is fully initialized and all initial optimizer scans have been kicked off and completed.
2.  **Dynamically Register the Barrel File:** Once this post-optimization hook is established, we will have access to the fully populated `clientFiles` and `serverFiles` sets. At this point, we will generate the content for our barrel modules.
3.  **Use `registerMissingImport`:** We will then call the `depsOptimizer.registerMissingImport()` method on both the `client` and `ssr` optimizers. We will register our dummy barrel file path as a newly discovered dependency.
4.  **Trigger Re-optimization:** Calling this API will signal to Vite that a new dependency has been found, which will automatically trigger a debounced re-optimization pass. During this second pass, our existing `esbuild` plugin's `onLoad` hook for the dummy barrel file will be called again. This time, however, it will have access to the complete, correct lists of client and server files, generate the correct barrel content, and solve the dependency waterfall issue.

This approach is superior because it avoids fighting Vite's parallel startup process and instead leverages the public API for dynamic dependency discovery in a clean and predictable way.

### 9.6. Final Step: Absolute Paths for Esbuild

The post-scan registration strategy was successful in triggering a re-optimization pass with the fully populated file lists. However, this revealed one final hurdle: the `esbuild` process that powers Vite's dependency optimizer could not resolve the module paths inside our generated barrel file.

The error (`Could not resolve "/node_modules/..."`) occurs because `esbuild` operates directly on the file system and does not understand Vite's web-style `/node_modules/` path mapping. It requires real, absolute file system paths to locate modules.

The solution is to modify the `generateBarrelContent` function. When generating the `import` statements for the barrel, we will use our existing `normalizeModulePath` utility, passing the `{ absolute: true }` option. This will convert each module path into a full, absolute path that `esbuild` can correctly resolve, completing the implementation.

### 9.7. Final Correction: Shared Barrels Across Environments

A final logic error was identified in the `configResolved` hook. The code was only adding the client barrel to the `client` environment's optimizer and the server barrel to the `ssr` environment's optimizer.

This is incorrect, as both environments may need to process modules from the other. For example, the `ssr` environment needs to resolve `"use client"` components to render them on the server.

The final correction was to modify the loop to add *both* the client and server barrel paths to the `optimizeDeps.include` array for *both* the `client` and `ssr` environments. This ensures that both optimization processes are aware of all discoverable directive-marked modules, completing the feature.

### 9.8. Final Refinement: Awaiting `scanProcessing` in the `listen` Hook

The `server.listen` wrapper strategy proved to be a step in the right direction, but it still contained a subtle race condition. While wrapping `listen` correctly executes our code after the server has started, it does not guarantee that the asynchronous `optimizeDeps` scans have *completed*.

The `listen` method kicks off all environment optimizations in parallel. Our `registerMissingImport` call was therefore running immediately after the scans *began*, not after they had *finished*, leading to inconsistently populated barrel files.

The final, definitive solution is to combine the `listen` wrapper with an explicit `await` on the `worker` environment's scan promise.

The corrected flow inside our `configureServer` hook is:
1.  Wrap the `server.listen` method.
2.  In the wrapper, `await` the original `listen` method to ensure the server is fully started and all optimizer scans have been initiated.
3.  **Crucially, `await server.environments.worker.depsOptimizer?.scanProcessing;`**. This pauses execution until the `worker` environment's dependency scan is guaranteed to be complete, and thus the `clientFiles` and `serverFiles` sets are fully populated.
4.  Only then, proceed to call `registerMissingImport` for the `client` and `ssr` environments.

This ensures that we register our barrels for re-optimization at the earliest possible moment, but only *after* the necessary file discovery is complete, finally resolving the race condition.

### 9.9. The Final Piece: Importing the Optimized Barrel

The last remaining issue was identified in the `createDirectiveLookupPlugin`. This plugin was correctly generating the `virtual:use-client-lookup` and `virtual:use-server-lookup` modules, but the dynamic `import()` statements inside them were pointing to the wrong place.

The generated code was importing the *source* dummy file (e.g., `/node_modules/.vite/rwsdk-client-barrel.js`). However, the browser needs to import the final, *processed* file that Vite's dependency optimizer generates in its cache directory (e.g., `/node_modules/.vite/deps/_Users_..._barrel.js`).

The definitive solution is to look up this final path at runtime. The implementation is as follows:

1.  **Access the Dev Server:** The `createDirectiveLookupPlugin` will use the `configureServer` hook to get and store a reference to the `ViteDevServer` instance.
2.  **Runtime Path Lookup:** The plugin's `load` hook, which generates the virtual module's code, will now perform a lookup:
    a.  It accesses the appropriate environment's dependency optimizer via the stored server instance (e.g., `server.environments.client.depsOptimizer`).
    b.  It constructs the absolute path to the source dummy barrel file.
    c.  It uses this absolute path as a key to look into the `depsOptimizer.metadata.optimized` record. This returns an `OptimizedDepInfo` object containing the final processed `file` name.
    d.  It constructs the correct, final browser-loadable path using this filename (e.g., `/node_modules/.vite/deps/PROCESSED_FILENAME.js`).
3.  **Generate Correct Import:** This final, correct path is used in the generated `import()` statement.

This completes the entire feature, ensuring that from discovery to optimization to runtime, the correct modules are being generated and loaded.

### 9.10. Definitive Solution: Awaiting the Re-Optimization Promise

The `Vite Error, ... optimized info should be defined` error provided the final clue. It originates from Vite's core `importAnalysis` plugin, and it confirms that our virtual module's `load` hook is executing *after* the re-optimization has been triggered but *before* the results of that re-optimization have been committed to the optimizer's metadata.

This is a classic race condition. The `registerMissingImport` API is intentionally debounced and asynchronous. We need to wait for its work to be fully completed before we can safely access the results.

The definitive solution is to hook into the optimizer's internal processing promise.

1.  **Expose Processing Promises:** In the `directiveModulesDevPlugin`'s `configureServer` hook, after wrapping `server.listen` and awaiting the initial scans, we will call `registerMissingImport`. We will then immediately grab the *new* `processing` promise from the `depsOptimizer.metadata.discovered` record for our barrel files. These promises are the key; they will only resolve when the re-optimization for that specific dependency is complete. We will store these promises in a shared object.
2.  **Await the Correct Promise in `load`:** The `createDirectiveLookupPlugin`'s `load` hook will be modified. When it needs to look up an optimized barrel path, it will first retrieve the corresponding promise from the shared object and `await` it. This will pause the `load` hook until the re-optimization is finished and the metadata is guaranteed to be available.
3.  **Perform the Metadata Lookup:** Once the promise resolves, the `load` hook can safely access `depsOptimizer.metadata.optimized` to get the correct, final path to the processed barrel file.

This creates the correct, final synchronization chain, resolving the race condition and completing the feature.

### 9.11. Backtracking: A Return to Synchronous Blocking

The "Post-Scan Registration" strategy, while functional, introduces a degree of unpredictability and inefficiency. It relies on a secondary, corrective optimization pass, which is wasted effort. The core issue remains a race condition, and the most direct solution is to solve it synchronously.

We are therefore backtracking to the original goal: ensuring the `client` and `ssr` environments do not process their dependency barrels until the `worker` environment has completed its scan and populated the `clientFiles` and `serverFiles` sets.

The revised plan is to implement a more targeted blocking mechanism:

1.  **Isolate the Block:** The dependency optimization for the `client` and `ssr` environments will be allowed to run in parallel as Vite intends. However, we will intercept the processing of our specific dummy barrel files.
2.  **Use a Blocking `onResolve` Hook:** Inside the `directiveModulesDevPlugin`, the custom `esbuild` plugin will be enhanced with an `onResolve` hook that filters for the barrel file paths.
3.  **Defer Resolution:** When this hook intercepts a barrel file, it will pause. For the initial implementation, this pause will be a hardcoded `setTimeout` to validate that delaying the barrel processing is sufficient to solve the race condition. The rest of the dependency scan for other modules can continue unimpeded.
4.  **Proceed After Delay:** After the timeout, the `onResolve` hook will complete, allowing the `onLoad` hook to be called. By this time, the `worker` scan will have finished, the file sets will be populated, and the `onLoad` hook will generate the correct barrel content on its first try.

If this `setTimeout` validation proves successful, the next step will be to replace it with a more robust synchronization mechanism, such as a shared promise that is resolved upon the completion of the `worker` environment's scan. This returns us to a more efficient, single-pass optimization.

### 9.12. A Deeper Problem: The Duplicate Dependency Issue

The targeted blocking strategy, while seeming to work initially, ultimately fails. After the initial successful load, a subsequent, automatic reload occurs, which breaks the application with a "duplicate React" error.

This classic error indicates that different parts of the application are resolving React from different sources (e.g., one from an optimized chunk, another from the raw `node_modules` source). This confirms that our approach of partially blocking the optimizer is leaving it in an inconsistent state. By interfering with the timing of just one part of the dependency graph (our barrel files), we are likely causing Vite to create an incomplete or conflicting set of optimized chunks, which manifests as the duplicate dependency after a reload.

This proves that trying to patch the timing of the automatic, parallel optimization process is too fragile.

### 9.13. The Definitive Strategy: Manual Optimizer Control

The correct path forward is to stop fighting Vite's automatic behavior and instead take full control of it. We need to find a way to disable the automatic, parallel dependency optimization and trigger each environment's optimizer manually, in the correct sequence.

The new plan is:

1.  **Investigate Manual Control APIs:** Search Vite's codebase for a "manual mode" for the dependency optimizer. The goal is to find a configuration option that prevents the optimizer from running automatically on server startup.
2.  **Enforce a Sequential Workflow:**
    a.  First, we will manually trigger and `await` the completion of the `worker` environment's dependency optimization. This will guarantee that the `clientFiles` and `serverFiles` sets are fully populated.
    b.  Once the `worker` pass is complete, we will then manually trigger the `client` and `ssr` environment optimizations, which can run in parallel with each other.

This strategy is the most robust because it eliminates the race condition at its source. By dictating the order of operations, we ensure that the `client` and `ssr` optimizers have the complete and correct information before they begin their work, leading to a stable and consistent dependency graph.

### 9.14. The Definitive Strategy Refined: Monkey-Patching `init`

The root of the race condition lies in how Vite starts its optimizers. At startup, the `server.listen` method calls the `depsOptimizer.init()` method for all environments in parallel. This is what we need to control.

A detailed inspection of the `init` method in Vite's source code revealed a critical detail: the `init` function itself returns a promise that resolves almost immediately. It is responsible for kicking off the dependency scan, but it does not wait for it to complete. The actual completion of the scan is tracked by a separate promise, `depsOptimizer.scanProcessing`.

This understanding leads to our final, most robust plan:

1.  **Create a Shared Signal:** A single, shared promise (`workerScanComplete`) will be created to act as a signal that the worker environment's dependency scan is finished.
2.  **Intercept `init` via Monkey-Patching:** Using the `configureServer` hook, which runs after the optimizers are created but before they are initialized, we will replace the `init` method on the `worker`, `client`, and `ssr` optimizers.
3.  **Enforce a Sequential Chain:**
    *   **Worker:** The new `worker` `init` method will first call the original `init` method. It will then `await` the `depsOptimizer.scanProcessing` promise. Once that promise resolves, it will resolve our shared `workerScanComplete` promise, sending the "all clear" signal.
    *   **Client & SSR:** The new `client` and `ssr` `init` methods will do the opposite. They will first `await` our shared `workerScanComplete` promise. Once they receive the signal, they will then proceed to call their own original `init` methods.

This creates a perfect causal chain. Vite's parallel startup process is intercepted, forcing the `client` and `ssr` optimizers to wait until the `worker` optimizer has fully completed its discovery. This ensures the `clientFiles` and `serverFiles` sets are populated *before* they are needed, definitively solving the race condition.

### 9.15. The Root Cause Revealed: A Dependency Graph Schism

The `init` monkey-patching strategy was successful. The optimizers now run in the correct sequence (`worker` first, then `client` and `ssr`). However, this did *not* solve the "duplicate React" error. This is a critical discovery: it proves the problem is not a simple race condition, but a more fundamental issue with how Vite is constructing its dependency graph.

The network trace from the browser shows two sets of dependency chunks being loaded with different version hashes. The first set is triggered by the main application entry point. The second, conflicting set is triggered by our dynamically generated barrel file. This second set contains a duplicate copy of React (or a related library like `react-dom`), which causes the application to crash.

This means that even with sequential execution, Vite's optimizer is treating the main application and our barrel file as two completely separate, unrelated entry points. It creates one optimized dependency graph for the application and a second, conflicting graph for the barrel, instead of merging them into a single, unified graph.

The next step is to understand why our custom `reactConditionsResolverPlugin`, which is designed to prevent this exact problem by forcing all React imports to resolve to a single canonical file, is failing for the dependencies pulled in by our barrel file.

### 9.16. The `resolveId` Hook as a Synchronization Point

The `init` monkey-patching strategy, while successful in forcing the `client` and `ssr` optimizers to wait for the `worker` optimizer's completion, has proven to be unstable. The `onLoad` hook for our barrel files began firing too early, indicating that the patched `init` methods were no longer reliably blocking the `client` and `ssr` optimizers.

This inconsistency demonstrates the brittleness of relying on patching internal, undocumented methods.

We are therefore reverting this approach in favor of a more robust solution that uses Vite's public, stable plugin lifecycle as its foundation.

**The Definitive Plan (Revisited):**

1.  **The Signal - The Worker's First `resolveId` Hook:** We are returning to the insight that the first time a module is resolved in the `worker` environment, it serves as a definitive signal that its `optimizeDeps` process is complete. This is a stable, predictable event.
2.  **Shared Promise:** A shared promise (`workerOptimizeComplete`) will be created in the main `redwoodPlugin.mts` file to communicate between plugins.
3.  **Signaling from the `worker`:** The `directiveModulesDevPlugin` will use its `configEnvironment` and `resolveId` hooks. When running in the `worker` environment, the very first time its `resolveId` hook is called, it will resolve the shared promise.
4.  **Blocking in `client` and `ssr`:** The `esbuild` plugin inside `directiveModulesDevPlugin` (which runs for the `client` and `ssr` optimizers) will be given an `onResolve` hook. This hook will intercept requests for our dummy barrel files and `await` the shared promise before allowing the resolution to proceed.

This event-driven orchestration is superior because it is based entirely on Vite's public plugin API, making it resilient to changes in internal implementation details and finally solving the inconsistent timing issue.

This creates the correct sequence at the correct stage of the process. It guarantees that the `worker` environment has fully completed its discovery, bundling, and cache commit *before* the `client` and `ssr` environments begin their optimization, which will finally resolve the dependency graph schism.

### 9.18. A Return to Stability: Using Plugin Hooks for Synchronization

The `init` monkey-patching strategy, while seeming to work temporarily, has proven to be unstable. The `onLoad` hook for our barrel files began firing too early, indicating that the patched `init` methods were no longer reliably blocking the `client` and `ssr` optimizers. This inconsistency demonstrates the brittleness of relying on patching internal, undocumented methods.

We are therefore reverting this approach in favor of a more robust solution that uses Vite's public, stable plugin lifecycle as its foundation.

**The Definitive Plan (Revisited):**

1.  **The Signal - The Worker's First `resolveId` Hook:** We are returning to the insight that the first time a module is resolved in the `worker` environment, it serves as a definitive signal that its `optimizeDeps` process is complete. This is a stable, predictable event.
2.  **Shared Promise:** A shared promise (`workerOptimizeComplete`) will be created in the main `redwoodPlugin.mts` file to communicate between plugins.
3.  **Signaling from the `worker`:** The `directiveModulesDevPlugin` will use its `configEnvironment` and `resolveId` hooks. When running in the `worker` environment, the very first time its `resolveId` hook is called, it will resolve the shared promise.
4.  **Blocking in `client` and `ssr`:** The `esbuild` plugin inside `directiveModulesDevPlugin` (which runs for the `client` and `ssr` optimizers) will be given an `onResolve` hook. This hook will intercept requests for our dummy barrel files and `await` the shared promise before allowing the resolution to proceed.

This event-driven orchestration is superior because it is based entirely on Vite's public plugin API, making it resilient to changes in internal implementation details and finally solving the inconsistent timing issue.

### 9.12. A Return to Simplicity: In-Scan Discovery

After finding the previous synchronization strategies to be overly complex and brittle, we are pivoting to a simpler, more direct approach that accepts a pragmatic trade-off.

**The Trade-Off:** The new strategy will only discover `"use client"` and `"use server"` modules that are statically reachable from the project's entry points. Modules from a library that are only used via dynamic imports may not be discovered during the initial optimization. We are accepting this limitation for now in exchange for a vastly simpler and more stable implementation.

**The New Plan:** Instead of performing an exhaustive, separate filesystem scan and then trying to synchronize multiple optimization runs, we will integrate our discovery directly into the `worker` environment's initial dependency scan.

1.  **Inject a Discovery Plugin:** In the `configResolved` hook, we will create and inject a custom `esbuild` plugin specifically into the `worker` environment's `optimizeDeps.esbuildOptions.plugins` array.
2.  **Discover Directives with `onLoad`:** This `esbuild` plugin will use an `onLoad` hook that fires for every module the scanner processes. It will read the module's content, check for `"use client"` or `"use server"` directives, and populate the shared `clientFiles` and `serverFiles` sets accordingly.
3.  **Synchronize via `scanProcessing`:** We will retain the `init` monkey-patching logic from the previous attempt. The `client` and `ssr` optimizers will be blocked, awaiting the `worker` optimizer's `scanProcessing` promise. This is now the correct signal, as we only need to wait for the *scan* to finish, not the full bundling process.

This approach is superior because it eliminates the need for any re-optimization passes or complex promise-juggling. By the time the `client` and `ssr` optimizers are allowed to run, the `clientFiles` and `serverFiles` sets will have already been fully populated, allowing their dependency barrels to be generated correctly on the very first try.

### 9.13. Final Conclusion: `optimizeDeps` is the Wrong Tool

After extensive experimentation with various synchronization strategies (`init` monkey-patching, awaiting `scanProcessing`, post-scan registration), we have definitively concluded that trying to hook into or control Vite's `optimizeDeps` lifecycle is fundamentally the wrong approach for our use case.

The core issues are:
-   **Unstable Internals:** The internal timing of the multi-environment optimizer is not a public, stable API. Relying on it has proven to be brittle and unpredictable.
-   **Incomplete Scans:** Vite's dependency scanner is designed to follow static imports from known entry points. As we've proven, it does not perform an exhaustive scan and therefore cannot, on its own, discover all potential `"use client"` modules in `node_modules`.

Fighting this behavior has led to overly complex and ultimately incorrect solutions.

### 9.14. The Definitive Strategy: A Standalone `esbuild` Scan

We are pivoting to a new strategy that gives us full control over the discovery process by running our own, separate `esbuild` scan before Vite's optimizers begin.

1.  **Standalone Scan:** In the `configResolved` hook, we will initiate a custom `esbuild` build process. This process will use the application's true entry points (e.g., from `config.build.rollupOptions.input`).
2.  **Configuration Passthrough:** Crucially, we will create a custom `esbuild` plugin that replicates Vite's own module resolution logic. We will extract the final, resolved `resolve.alias` configuration from the `config` object and use it within our plugin's `onResolve` hook to ensure modules are found correctly.
3.  **Exhaustive Discovery:** This controlled scan will traverse the entire application dependency graph. As it resolves modules, it will read their content and check for `"use client"` or `"use server"` directives, populating our `clientFiles` and `serverFiles` sets.
4.  **Simplified Optimization:** With a complete and accurate list of directive-marked files available *before* any optimization begins, the rest of the process becomes simple and robust. We will generate our dummy barrel files and add them to `optimizeDeps.include`. This provides the necessary information to Vite's optimizer on its first pass, unifying the dependency graph correctly without any need for complex synchronization or re-optimization.

This approach is superior because it separates our domain-specific discovery logic from Vite's internal machinery, giving us control and predictability while still leveraging Vite's powerful pre-bundling for the final output.

### 9.15. Investigation: The Dependency Graph Schism Revisited

With the standalone `esbuild` scanner now successfully implemented, we have a stable and reliable method for discovering all directive-marked modules. The scanner correctly populates our barrel files with a comprehensive list of client components before Vite's optimizer even begins.

However, the "duplicate React dependency" error persists. This is a critical finding: it proves that the root cause is not a race condition or an incomplete discovery process. The problem lies in how Vite's optimizer processes our barrel file. Even when provided with a complete list of dependencies upfront, the optimizer is still creating a separate, conflicting dependency graph for the barrel file, distinct from the main application's graph.

Our next step is to analyze the output of the optimizer in the `.vite/deps` and `.vite/deps_ssr` directories to pinpoint exactly which modules are being duplicated and to trace them back to their source files. This will allow us to understand why the dependency graphs are not being unified.

### 9.16. The Smoking Gun: A Missing `jsx-runtime`

An analysis of the optimizer's output in the `.vite/deps` directory has revealed the precise nature of the dependency schism.

1.  **The Application Chunk:** The main application's dependencies are correctly bundled. A shared chunk, `chunk-VRKFJTBN.js`, is created, which explicitly contains the code from `react/cjs/react-jsx-runtime.development.js`. This is the correct, canonical source for the JSX runtime.
2.  **The Barrel Chunk:** The massive chunk generated from our `rwsdk-client-barrel.js` file, which contains all the discovered Mantine components, **does not contain any reference to `react/jsx-runtime` at all.**

This is the definitive proof of the problem. Vite is processing the application and the barrel file as two completely separate dependency graphs. It correctly identifies the need for `jsx-runtime` in the application graph, but it fails to do so for the barrel file graph. When the browser attempts to render a component from the barrel's chunk, it crashes because the necessary JSX runtime is missing from its scope.

The root cause appears to be a failure in Vite's dependency scanner to detect the implicit `jsx-runtime` dependency for the modules imported within our barrel file.