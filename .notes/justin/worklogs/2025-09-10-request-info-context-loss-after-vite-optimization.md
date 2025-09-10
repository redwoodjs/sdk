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
