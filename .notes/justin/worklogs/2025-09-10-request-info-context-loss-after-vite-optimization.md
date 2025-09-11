# Work Log: Request Info Context Loss after Vite Optimization

**Date:** 2025-09-10

## Problem

The `requestInfo` object, which provides request-scoped context via Node.js `AsyncLocalStorage`, loses its state after Vite performs its dependency optimization step. When a server action is called after a new dependency has been optimized, properties accessed via `requestInfo` (e.g., `requestInfo.response`, `requestInfo.request`) resolve to `undefined`. This results in a `TypeError` when code attempts to access properties on these undefined values, such as `requestInfo.response.save()`.

## Context & Narrative

The root cause is a module duplication issue. Here's the sequence of events leading to the failure:

1.  **Initial State:** The development server starts, and the `rwsdk` is loaded as a standard module. `requestInfo` and its underlying `AsyncLocalStorage` instance are created in memory.
2.  **Trigger:** A new, previously uncached dependency is encountered during a request (e.g., `@simplewebauthn/browser` or `@simplewebauthn/server` as seen in the logs).
3.  **Vite Optimization:** Vite's dev server detects this and runs its dependency optimization process. This process bundles the `rwsdk` and other dependencies into an optimized module stored in `node_modules/.vite/deps_worker`.
4.  **Module Duplication:** The Vite worker is then reloaded. Crucially, parts of the application now import the *new, optimized* `rwsdk` module. This means we now have two distinct instances of the `rwsdk` module in the same Node.js process.
5.  **Context Loss:** Each module instance has its own top-level scope. Therefore, each has its own unique `AsyncLocalStorage` instance for `requestInfoStore`. The context that was set using the `AsyncLocalStorage` from the *original* module is not accessible to the *optimized* module.
6.  **Failure:** When the server action (`startPasskeyRegistration`) is executed, it's running within the context of the new, optimized module. It attempts to read from its `requestInfo` object, which tries to get the store from its local `AsyncLocalStorage` instance. Since the request context was established by a different instance, `getStore()` returns `undefined`, the getters on `requestInfo` return `undefined`, and the application crashes.

The core issue is the loss of a singleton pattern for the `requestInfo` context provider due to module duplication, a side-effect of a necessary build tool optimization.

This problem has surfaced now due to a recent architectural change. Previously, the an of `use client` and `use server` directives was coupled with Vite's dependency optimization (`optimizeDeps`). This coupling added significant complexity. The process has been simplified to perform a direct, initial scan for directives, independent of `optimizeDeps`. As a result, `optimizeDeps` now operates without our intervention, discovering and optimizing worker dependencies on its own schedule. This can lead to re-optimization during a request, which in turn causes new instances of modules like the SDK to be created, triggering the context loss issue.

## Plan & Attempts

The goal is to ensure that there is only one instance of the `requestInfoStore` (`AsyncLocalStorage`) shared across all versions of the `rwsdk` module that may exist in the environment.

### Proposed Solutions

1.  **Global Singleton:** The most direct approach is to enforce a singleton pattern by storing the `AsyncLocalStorage` instance on a global object (`globalThis`). The `rwsdk` module, upon loading, would first check for an existing instance on `globalThis`. If found, it uses it; if not, it creates one and attaches it to `globalThis`. This ensures all instances of the module, regardless of how they are bundled or loaded, share the same context store.
2.  **Vite Configuration:** Investigate if Vite's `optimizeDeps` configuration can be tuned to treat `rwsdk` in a way that avoids this duplication. This seems less likely to succeed because the optimization itself is required, but it's worth a brief exploration.
3.  **Dependency Injection:** A major architectural change would be to stop relying on an ambiently available `requestInfo` object and instead pass it explicitly down the call stack from the request entry point. This would solve the problem but would require a significant and potentially undesirable refactoring of the codebase.

The **Global Singleton** approach seems to be the most pragmatic and least disruptive solution.

### Decision

We will proceed with the **Global Singleton** approach, but with a modification: the global singleton will only be used in development (`process.env.NODE_ENV !== 'production'`). This avoids any potential side effects in the production environment where the module duplication issue does not occur.

### Attempt 2: Investigation

After implementing the global singleton, the issue persists, but in a more specific manner. The logs now show that `requestInfo.request` is correctly resolved within the server action after the Vite dependency reload. However, `requestInfo.response` is still `undefined`, leading to the same `TypeError: Cannot read properties of undefined (reading 'save')` crash.

This indicates that while the `AsyncLocalStorage` instance is now correctly shared between the different module instances, the `response` property within the stored context is being lost or overwritten somewhere in the execution path of the server action. The next step is to trace how the `requestInfo` object is handled and modified during the request lifecycle, particularly around server action invocations, to pinpoint where the `response` object is being dropped.

### Attempt 3: Fix `runWithRequestInfoOverrides`

The issue was traced to the `runWithRequestInfoOverrides` function. It was using object spreading (`{ ...requestInfo, ...overrides }`) to create a new `requestInfo` object. This had the unintended side effect of evaluating the getters on the `requestInfo` proxy object and creating a static, plain object that was disconnected from the `AsyncLocalStorage` context.

The fix is to use `Object.assign(requestInfo, overrides)` instead. This modifies the existing `requestInfo` object in place, preserving its nature as a proxy and ensuring that the context remains consistent.

## Attempt 5: Pivot to Root Cause Fix

The previous attempts, while partially successful, were fundamentally flawed as they only treated the symptoms of the underlying issue. The global singleton pattern and `optimizeDeps.include` both introduce their own problems, such as being leaky abstractions or too fragile for user-configured dependencies.

The correct approach is to address the root cause: Vite's dependency optimizer is unaware of the application's full dependency graph at startup. This leads to late discovery of dependencies and a disruptive re-optimization pass.

The new plan is to revert all previous changes and implement a more robust solution within the `configPlugin`.

### The New Plan

1.  **Revert Changes:** All modifications to `sdk/src/runtime/requestInfo/worker.ts` will be reverted to their original state.
2.  **Use `optimizeDeps.entries`:** We will leverage the `clientFiles` and `serverFiles` sets, which are available ahead of time thanks to our directive scanning.
    -   For the `client` environment, we will filter `clientFiles` to include only application code (not in `node_modules`) and add these paths to the `optimizeDeps.entries` array.
    -   For the `worker` environment (and not the `ssr` environment), we will do the same with `serverFiles`.

By providing Vite with a complete list of application entry points for the correct environments, its optimizer can build a full dependency graph from the start, preventing any subsequent, disruptive re-optimization. This is a framework-level solution that is both robust and transparent to the user.

## Attempt 6: Correcting the Timing

The previous attempt was conceptually correct but failed due to a misunderstanding of Vite's lifecycle. The `clientFiles` and `serverFiles` are not available in the `config` hook because the directive scan that generates them has not yet run.

The scan is initiated in the `configureServer` hook, and Vite's dependency optimizer is blocked until the scan completes via a custom `esbuild` plugin with an `onStart` hook. This `onStart` hook is the correct place to modify the Vite config.

### The Corrected Plan

1.  **Revert Incorrect Changes:** The changes made to `sdk/src/vite/configPlugin.mts` will be reverted.
2.  **Programmatic Config Update:** In `sdk/src/vite/directiveModulesDevPlugin.mts`, within the `esbuild` `onStart` hook:
    -   First, `await` the `scanPromise` to ensure the file lists are populated.
    -   Then, access the resolved Vite config (which is available in the plugin's closure).
    -   Filter the `clientFiles` and `serverFiles` to get application-specific code.
    -   Dynamically push these file paths into `optimizeDeps.entries` for the `client` and `worker` environments, respectively.

This ensures that we modify the configuration at the last possible moment, after we have the information we need but before the optimizer begins its work.

## Attempt 11: Application Barrel Files (Failure)

The application barrel file strategy, while successfully getting the server barrel file resolved by the `worker` optimizer, ultimately failed to solve the root problem.

### Debugging Results

Even with the application barrels in place, a Vite dependency re-optimization is still observed in the logs (seemingly for the client-side). Critically, the module-level state loss continues to occur. This suggests that either:
a) The client-side re-optimization is somehow causing the worker's state to be wiped.
b) Our core hypothesis that the re-optimization is the cause of the state loss is incorrect, and we have been chasing a red herring.

## Attempt 12: Confirming the Cause of State Loss

To move forward, we need to definitively confirm *when* and *why* the module-level state is being cleared. The new plan is to add targeted logging to a module that holds state.

### The New Plan

1.  **Add Logging to State Module:** A `console.log` statement will be added to the top level of `starters/standard/src/session/store.ts`.
2.  **Observe Timing:** We will run the application and observe the timing of this new log message relative to Vite's "re-optimizing" log.
    - If the "Session store re-initialized" log appears immediately after the Vite log, it confirms that the re-optimization is directly causing the module to be reloaded and its state to be reset.
    - If the timing does not correlate, it points to a different, unknown cause for the state loss.

This will give us the direct evidence we need to either confirm our hypothesis or pivot to a new one.

## Attempt 12 Results: Confirmation

The canary log in `session/store.ts` provided the definitive proof. The `"## session store"` message appears in the console immediately following Vite's `(worker) ✨ optimized dependencies changed. reloading` message.

This confirms that our core hypothesis is correct: the dependency optimization pass for the **worker environment** is the direct and sole cause of the module-level state being reset.

## Attempt 13: Investigating the Barrel File Contents

Although our logging shows that `esbuild` is resolving the path to the server application barrel, the worker optimization is still being triggered. This strongly suggests a timing issue: `esbuild` might be reading the barrel file *before* our asynchronous scan has had a chance to populate it with the application's `import` statements.

### The New Plan

To verify this, we will enhance our `esbuild` logging plugin.
1.  In addition to the `onResolve` hook, we will add an `onLoad` hook.
2.  This hook will trigger for our barrel file paths, read their content from the disk at that moment, and log it to the console.

This will show us exactly what `esbuild` is seeing when it loads the file. If it logs empty content, we have a confirmed timing race condition. If it logs the correct `import` statements, the problem lies deeper within `esbuild`'s scanning behavior.

## Attempt 13 Results: A New Clue

The `onLoad` hook never fired. This is a critical discovery. It proves that the problem isn't a race condition where `esbuild` reads an empty file; the problem is that `esbuild` isn't attempting to load the file *at all*.

The most likely hypothesis is that Vite's dependency optimizer performs a preliminary check on its entry points. When it sees our dummy barrel file is empty at the start of the process, it likely discards it as an invalid entry point, and therefore never asks `esbuild` to load or parse it.

## Attempt 14: Delaying Barrel File Creation

To solve this, we must ensure the barrel file path does not exist on the filesystem until it contains the content we want the optimizer to scan.

### The New Plan

1.  **Remove Dummy File Creation:** The `writeFileSync` calls that create empty "dummy" barrel files in the `configResolved` hook will be removed.
2.  **Write Only When Ready:** The barrel files (both for dependencies and for the application) will be written to disk only once, inside the `.then()` block of the `scanPromise` in `configureServer`.

This guarantees that when the optimizer, which is blocked by our `onStart` hook, is finally allowed to proceed, it will see a valid, non-empty file, forcing it to load and process the contents.

## Attempt 14 Failure & Pivot

Delaying the file creation did not work; it appears Vite requires the entry point files to exist on disk when the configuration is first resolved. This brings us back to the original mystery: why does Vite's optimizer ignore the entry points when they are initially empty?

The `onLoad` hook still doesn't fire, suggesting the files are discarded before `esbuild` is even invoked. This could be due to a difference in how Vite handles `optimizeDeps.entries` versus `optimizeDeps.include`. The `entries` array is for application entry points, and Vite may have stricter validation for them (like checking for non-empty content). The `include` array is for forcing modules, which might follow a different, more lenient path.

## Attempt 15: Using `optimizeDeps.include`

The new strategy is to treat our application barrel files as if they were third-party modules and force them into the optimizer using the `include` array.

### The New Plan

1.  In the `configResolved` hook, the paths to `APP_CLIENT_BARREL_PATH` and `APP_SERVER_BARREL_PATH` will be pushed to the `optimizeDeps.include` array for their respective environments, instead of the `entries` array.

This is a small change, but it targets a potentially different internal code path in Vite's optimizer that may be more suitable for our dynamically populated files. Our `esbuild` logging plugin remains in place to verify if this change causes the `onLoad` hook to fire.

## Attempt 16: Adding Write-Time Logging

To get a clearer picture of the timing, the next step is to add logging to pinpoint the exact moment we write the content to the barrel files.

### The New Plan

1.  A `console.log` statement will be added to the `.then()` block of the `scanPromise` in the `configureServer` hook, immediately before the `writeFileSync` calls.
2.  By comparing the timestamp of this new "writing" log with the existing "resolving" log from our `esbuild` plugin, we can definitively determine if a race condition exists. If the resolve happens before the write, our hypothesis is confirmed.

## Attempt 18: A Deeper Timing Paradox

The latest logs presented a baffling contradiction. The `onResolve scan complete` log for the `worker` was appearing *before* the `[rwsdk] Barrel files written` log.

This meant that `await scanPromise` was finishing, and the optimizer was proceeding to the `onLoad` step, *before* the barrel files had been populated with content. The optimizer was correctly blocked, but it was being unblocked too early and was therefore reading an empty file, which is functionally the same as the scan not running at all and is the direct cause of the re-optimization.

The root cause was a flaw in our own logic: the `scanPromise` was resolving as soon as the `runDirectivesScan` function completed, not waiting for the subsequent `.then()` block (where the file writing happens) to finish.

The solution was to revert to the deferred promise pattern (`Promise.withResolvers`), which had been incorrectly removed in a previous step. This ensures the promise is only resolved *after* the `writeFileSync` calls are complete, guaranteeing the optimizer will see a populated file.

## Attempt 19: The Plugin Ordering Breakthrough

Even with the deferred promise, the logs showed that our `onResolve` hook was firing *after* many other internal Vite `onResolve` logs. This was a critical insight from the user: our plugin was being added to the end of the `esbuild` plugin array with `.push()`, meaning it was running last. If another plugin resolved the path first, our blocker would never even run.

The fix was to change `.push()` to `.unshift()`, ensuring our blocking plugin is the very first one in the chain. This guarantees it can intercept the barrel file paths before any other plugin.

## The Current Paradox: Correct Timing, Persistent Failure

The combination of the deferred promise and the `unshift` strategy has produced logs that, on the surface, look perfect.
1.  Our `onResolve` hook fires first for the `worker` environment.
2.  It correctly awaits the `scanPromise`.
3.  The scan runs, completes, and writes the files.
4.  Only then does the `scanPromise` resolve, unblocking `onResolve`.
5.  Our test log confirms that `esbuild` then proceeds to load the application code (`user/functions.ts`) from within the barrel file.

And yet, the fundamental problem remains. Vite's logs *still* show `(worker) ✨ new dependencies optimized: @simplewebauthn/server`, and the application still crashes with the original context loss error.

This leads to a new, core hypothesis: the problem is not with our blocking strategy, but with **how Vite's optimizer is interpreting our entry points**. It seems that even though `esbuild` is correctly loading the files from our barrel, the higher-level Vite dependency scanner is not performing a deep traversal of their contents during its initial pass. It only discovers the deep import (`@simplewebauthn/server`) when a request is made, which triggers the dreaded re-optimization. The question is, why?

## Attempt 21: The `async config` Timing Failure

The hypothesis that a synchronous scan in `async config` was the solution was tested and immediately proven incorrect by the user, who pointed out a critical flaw in the logic: `optimizeDeps` is configured and potentially initiated *before* an `async config` hook's `await` would complete. Any modifications made to `optimizeDeps.entries` after the `await` would be too late, as the optimizer process would have already started with the initial configuration. This "misses the bus" entirely and makes the synchronous approach in `config` non-viable.

## Attempt 22: Forcing Content with `onLoad`

The new hypothesis, based on the user's direction, is that while our `onResolve` hook is correctly blocking the optimizer, the subsequent step may be failing. It's possible that `esbuild` is not correctly reading or processing the content of our barrel files from the disk after `onResolve` completes.

The next experiment is to force the issue. Instead of letting `esbuild` load the file itself, our `onLoad` hook will be responsible for:
1.  Reading the barrel file content from disk.
2.  Returning it directly to `esbuild` via the `{ contents: ... }` object.

This bypasses `esbuild`'s own file loading mechanism and guarantees that it sees the content that our plugin provides, which should force it to traverse the `import` statements within and discover the application dependencies.

## Attempt 23: The Traversal Failure

The "Forcing Content with `onLoad`" strategy has yielded a critical new clue. The logs confirm that for the `worker` environment:
1.  The `onLoad` hook for our `app-server-barrel.js` is successfully triggered.
2.  We successfully read its content and return it to `esbuild`.
3.  However, `esbuild` does **not** proceed to resolve or load the application files (`.../functions.ts`) that are imported from within the barrel's content.

This proves that the breakdown is happening inside `esbuild`'s processing of the provided content.

The new hypothesis is that `esbuild` is losing its file-system context. Because the barrel file lives in a temporary directory (`/var/folders/...`), `esbuild` may not know how to correctly resolve the absolute paths (`/Users/justin/...`) that are written inside it.

The next attempt will be to provide `esbuild` with an explicit resolution directory to anchor its resolver. The `onLoad` hook can return a `resolveDir` property. By setting this to the project's root directory, we can give `esbuild` the context it needs to correctly process the barrel file's contents and traverse its imports.

## Attempt 24: Project-Local Barrel Files

The `resolveDir` strategy unfortunately had no effect; `esbuild` still refused to traverse into the barrel file's imports for the `worker` environment. This is a strong indicator that the issue is not just about resolution context, but about the location of the barrel file itself.

The new hypothesis is that Vite's dependency optimizer, for security or caching reasons, does not fully trust or deeply process files that are located outside of the project's root directory (e.g., in `/var/folders/...`).

To test this, the next attempt will be to move the barrel files from the system's temporary directory to a predictable, git-ignored location inside the project itself. By writing the files to `./.rwsdk/temp/`, we can test if Vite/esbuild treats them as "first-class" project files and processes them correctly.

## Attempt 25: Vite Source Code Investigation (The `stdin` Breakthrough)

An investigation of Vite's internal optimizer source code, specifically `packages/vite/src/node/optimizer/scan.ts`, revealed the fundamental reason for our failures. Vite does not pass `optimizeDeps.entries` to `esbuild` as file paths. Instead, it generates a single, in-memory "virtual file" consisting of `import` statements for each entry and pipes this to `esbuild` via `stdin`.

This explains everything:
1.  Our `esbuild` plugin was operating in a rootless, virtual context.
2.  The absolute paths inside our barrel file's content were likely being ignored by `esbuild` because it had no file-system anchor to resolve them from.
3.  Strategies like `resolveDir` and moving the file were ineffective because the *importer* of our barrel file was virtual, not the barrel file itself.

### The New Hypothesis and Plan

The new hypothesis is that `esbuild` will correctly traverse the barrel file's imports if the paths are relative and it's given a directory to resolve them from.

The final plan is to combine two previous strategies:
1.  **Relative Paths:** The `generateAppBarrelContent` function will be modified to generate relative paths from the project root (e.g., `import './src/some/file.ts'`).
2.  **Provide `resolveDir`:** The `onLoad` hook will continue to return the barrel file's content directly, but will also provide the `resolveDir: projectRootDir` option, giving `esbuild` the anchor it needs to resolve the new relative paths.

## Attempt 26: The Relative Path Failure & a New Conclusion

The "Relative Paths + `resolveDir`" strategy also failed. Even when providing `esbuild` with what should have been a perfectly valid context (relative paths inside the content and a base directory to resolve them from), the `worker` optimizer's scanner still refused to traverse into the application files imported by our barrel.

This string of failures, combined with the `stdin` insight, leads to a new, more fundamental conclusion about the nature of Vite's dependency scanner.

### The Core Problem, Refined

The issue is not one of timing, plugin ordering, or file-system context alone. The root of the problem appears to be the **intended behavior of Vite's dependency scanner itself.**

1.  **The Scanner is Shallow for User Code:** In development, the primary purpose of `optimizeDeps` is to find bare module imports that resolve to `node_modules` and pre-bundle them. It is not designed to perform a deep, transitive dependency analysis of the entire application codebase via `optimizeDeps.entries`.
2.  **`stdin` Exacerbates This:** The `stdin` virtual file approach reinforces this. It's a mechanism to quickly find top-level imports, not to crawl an application.
3.  **The `worker` Environment is Different:** The fact that this behavior is so pronounced in the `worker` environment suggests it has a more constrained or specialized optimization strategy compared to the `client` environment.

This explains why all of our barrel file strategies have failed. We are asking the dependency scanner to do a job—deeply analyzing application code—that it is not designed or configured to do at startup. It loads our barrel file, sees no direct `node_modules` imports, and simply stops.

This brings us back to the core dilemma you articulated: the only strategy that has been *proven* to work is feeding the file paths directly into `optimizeDeps.entries` before the optimizer starts. And the only way to get that list of files is with a synchronous scan that blocks the server startup, which creates a user experience problem we've been trying to solve since the beginning.
