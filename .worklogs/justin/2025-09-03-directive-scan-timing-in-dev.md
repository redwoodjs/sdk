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

## 5. Final Strategy: A "Just-In-Time" Scan

The patching strategy, while theoretically sound, proved to be unreliable in practice. The core issue remained that interfering with Vite's internal startup lifecycle is inherently fragile.

The final, successful, and dramatically simpler solution is to abandon patching entirely and run the scan "Just-In-Time."

The insight is that we don't need to preemptively run the scan and then pause other processes. Instead, we can wait until the `client` or `ssr` optimizer *first asks for one of our barrel files*. At that precise moment, we know the scan results are needed, and we can be reasonably certain that the dev server and its environments have been instantiated.

The implementation is as follows:
1.  **Store the Server Instance:** We use the standard `configureServer` hook for one simple purpose: to get and store a reference to the `ViteDevServer` instance.
2.  **Trigger Scan on First Resolution:** We retain the custom `esbuild` plugin that is injected into the `client` and `ssr` optimizers. Its `onResolve` hook still intercepts requests for our barrel files.
3.  **Run Scan Inside `onResolve`:** The first time this hook is triggered, it uses the stored server reference to access `server.environments.worker` and *then* runs the `runDirectivesScan`. A guard ensures the scan is only run once, with subsequent requests awaiting the result of the first scan.
4.  **Generate Barrels and Proceed:** Once the scan promise resolves, the `onResolve` hook generates the barrel content (using the now-populated file sets) and allows the optimization to proceed.

This approach is superior because it eliminates all fragile monkey-patching, relies on stable public APIs, and performs the expensive scan only at the precise moment it is first required. It is simpler, more robust, and more aligned with Vite's event-driven nature.

## 6. Final Refinement: "Just-in-Time" Content Generation via `onLoad`

The "Just-In-Time" scan was the correct strategy, but the implementation was further refined for efficiency and robustness.

The previous iteration used a broad `onResolve` hook (matching `/.*/`) that executed for every module, and it wrote the barrel files to the filesystem. The final solution is more targeted and elegant.

The implementation uses a pair of `esbuild` plugin hooks:
1.  **A targeted `onResolve` hook:** This hook filters *only* for our two barrel file paths. When it finds one, its only job is to tag it with a special namespace (e.g., `"rwsdk-barrel"`). This marks the file as something to be handled by our plugin's `onLoad` hook.
2.  **An `onLoad` hook:** This hook is configured to fire only for modules tagged with our `"rwsdk-barrel"` namespace.
    *   The first time it's called, it triggers the `runDirectivesScan` (guarded by a promise to ensure it only runs once).
    *   It `await`s the scan's completion.
    *   It then generates the barrel content in memory.
    *   Finally, it returns the content directly to `esbuild` via the `contents` property, completely bypassing the filesystem.

This is the definitive solution because it is the most efficient (the hook only runs for files we care about), the most robust (it avoids filesystem race conditions), and the most semantically correct use of the `esbuild` plugin API.

## 7. Final Implementation: The "Dummy File" Strategy

The "Just-In-Time" content generation via `onLoad` was the correct strategy, but it was further refined to be more compatible with Vite's file-based dependency scanner.

The final, definitive implementation uses a physical "dummy file" to provide a stable target for `esbuild`, and then hijacks the loading of that file to provide the dynamic content.

1.  **Create Dummy Files:** In the `configResolved` hook, which runs before the optimizer, we now physically create empty placeholder files on disk for our client and server barrels. This gives `esbuild` a real, resolvable file path.
2.  **Simplify the `esbuild` Plugin:** Because the files now physically exist, the `onResolve` hook and custom namespaces are no longer needed. Our `esbuild` plugin is simplified to a single `onLoad` hook.
3.  **Targeted `onLoad`:** This `onLoad` hook filters directly for the absolute paths of the two dummy barrel files.
4.  **Just-in-Time Scan and Content Injection:** The `onLoad` hook's logic remains the same. The first time it's triggered for one of the dummy files, it runs the directive scan (guarded by a promise). Once the scan completes, it generates the appropriate barrel content in memory and returns it directly to `esbuild`, effectively replacing the empty content of the dummy file.

This is the most robust solution because it works with `esbuild`'s file-based nature while still providing our content dynamically, all triggered at the exact moment it's needed.

### 8. The Definitive Fix: Plugin Ordering (`enforce: 'post'`)

After extensive investigation into Vite's resolver and `esbuild`'s behavior, the final solution was discovered to be an issue of **plugin ordering**. Two distinct but related problems were solved:

1.  **Architectural Flaw:** Our initial scanner used a simplistic, custom alias resolution logic. The switch to using Vite's `createIdResolver` was a critical architectural improvement. While this change alone did not fix the immediate bug, it made our scanner significantly more robust and compatible with the Vite ecosystem by aligning it with the same resolver that Vite's own dependency optimizer uses.

2.  **Timing/Ordering Flaw:** The direct cause of the alias resolution failure was that our `configPlugin` was running *before* other plugins (e.g., `vite-tsconfig-paths`) had a chance to add their aliases to the configuration. When our scanner ran, it was working with an incomplete set of aliases. The initial focus on the `@/*` syntax was a **red herring**; the problem was that we were missing aliases from any plugin that ran after ours.

The solution was to fix the ordering:

-   **Add `enforce: 'post'` to `configPlugin.mts`:** This Vite-specific property forces our plugin to run *after* all other plugins. This guarantees that when our `configResolved` hook executes, the configuration contains the complete, final list of aliases from all sources.

This ordering change was the definitive fix for the bug. It ensured that our architecturally sound scanner—now powered by `createIdResolver`—was finally being fed the correct data.
