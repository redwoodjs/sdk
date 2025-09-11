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
