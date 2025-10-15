# Resilient Module State Management in Dev

## Problem

The Vite dev server's dependency re-optimization process causes instability in our framework. When a new dependency is discovered during a development session, Vite triggers a re-optimization, which reloads modules. Our framework relies on module-level state (e.g., for `AsyncLocalStorage` contexts in request handling). This reload process discards the existing module instances and creates new ones, effectively wiping out all module-level state. This leads to application crashes and a frustrating developer experience.

While we have implemented a proactive dependency scanning mechanism to minimize the occurrences of re-optimization, it does not eliminate them entirely. Any unforeseen dependency can still trigger a reload and bring down the application. We need a more resilient solution that can withstand these re-optimization events.

## Solution

The proposed solution is to introduce a centralized, virtual state module that is insulated from Vite's re-optimization process. This module will be the single source of truth for all framework-level module state. By marking this module as "external" to Vite's dependency optimizer, we can ensure that its state persists across reloads, even when other application and framework modules are re-instantiated.

This approach offers two primary benefits:
1.  **Dev Server Stability**: It directly solves the state-loss problem during re-optimization, making the dev server more resilient.
2.  **Centralized State Management**: It encourages a more organized approach to state management within the framework. By centralizing state, we make it easier to reason about, debug, and maintain.

### Implementation Details

The implementation will involve creating a new Vite plugin and a dedicated state module.

1.  **Virtual State Module (`rwsdk/__state`)**:
    We will introduce a new virtual module specifier, `rwsdk/__state`. This module will not correspond to a single real file on disk in a way that's directly resolvable by Node or TypeScript, but will be handled by our custom Vite plugin. It will export an API for state management, for instance:
    -   `defineRwState(key, initializer)`: A function to define and initialize a piece of state. It will ensure the initializer is only called once.
    -   `getRwState(key)`: To retrieve a piece of state.
    -   `setRwState(key, value)`: To update a piece of state.

2.  **Physical State Module File**:
    The actual implementation of the state management logic will reside in a physical file, for example, `sdk/src/runtime/state.mts`. This file will contain the state container (e.g., a simple exported `const state = {}`) and the implementation of the state management functions.

3.  **Custom Vite Plugin (`statePlugin.mts`)**:
    A new Vite plugin will be created to manage the `rwsdk/__state` module.
    -   **`configEnvironment` Hook**: This hook will be used to inject a custom `esbuild` plugin into Vite's `optimizeDeps` configuration for the `worker` environment. The `esbuild` plugin's `onResolve` handler will intercept `rwsdk/__state` and mark it as `external: true`. This is the key step to prevent it from being processed and re-optimized by Vite's dependency scanner.
    -   **`resolveId` Hook**:
        -   In **dev mode**, when this hook encounters the `rwsdk/__state` specifier, it will return a virtualized ID (e.g., `virtual:rwsdk:__state`). This signals to Vite that this module requires custom loading logic.
        -   In **build mode**, this hook will resolve `rwsdk/__state` to the absolute path of the physical state module file (`sdk/src/runtime/state.mts`). This allows the module to be bundled normally for production.
    -   **`load` Hook**:
        -   In **dev mode**, this hook will be triggered for the virtual ID. It will read the content of the physical state module file (`sdk/src/runtime/state.mts`) from disk and return it as code. This serves the module's content to the browser/worker without it being part of the dependency graph that `optimizeDeps` is aware of. We can use constants from `sdk/src/lib/constants.mts` to locate this file.

### Example Usage

With this new mechanism, a module like `requestInfo/worker.ts` can be refactored to be stateless. Instead of defining its own module-level state, it will use the centralized state module:

```typescript
// sdk/src/runtime/requestInfo/worker.ts
import { defineRwState } from 'rwsdk/__state';
import { AsyncLocalStorage } from 'async_hooks';

// The initializer function is only called once, and the resulting
// AsyncLocalStorage instance is preserved across re-optimizations.
const requestInfoStore = defineRwState('requestInfoStore', () => new AsyncLocalStorage());

// ... rest of the implementation using requestInfoStore ...
```

This design makes our framework significantly more resilient to Vite's re-optimization behavior during development and improves the overall architecture of state management within the framework.

## Verification Plan: `requestInfo` Playground

To ensure the solution is robust, a new playground example named `requestInfo` will be created. This playground will serve as a dedicated test bed for verifying module state resilience in both development and production environments. It will be based on the `hello-world` template.

### `testDev`: Verifying Resilience to Re-optimization

The primary goal of the `dev` test is to simulate a scenario that would previously have caused a crash: a mid-session dependency re-optimization.

1.  **Setup**: The test will start the dev server and navigate to a page that displays data derived from `requestInfo`. It will also include a component that can be modified to introduce new dependencies.
2.  **Initial State Assertion**: It will first verify that the `requestInfo` data is correctly displayed on the initial page load.
3.  **Dynamic Import Simulation**: The test will then programmatically modify a source file to add new `import` statements. These imports will pull in modules that were not part of the initial dependency graph, forcing a Vite re-optimization. We will test three types of dynamically imported modules:
    *   A module with a `"use client"` directive.
    *   A module with a `"use server"` directive.
    *   A module with no directive.
    *   Each of these modules will, in turn, import a dependency from a local package (similar to the `import-from-use-client` playground) to ensure the dependency graph change is non-trivial.
4.  **Post-HMR Assertion**: After the file modification and subsequent Hot Module Replacement (HMR), the test will verify two things:
    *   The page has been updated to reflect the newly imported components.
    *   The state managed via `rwsdk/__state` (exposed through `requestInfo`) has remained stable and has not been reset. This is the critical validation for the dev server solution.

### `testDeploy`: Verifying Production Build

The `deploy` test will confirm that the state management mechanism works correctly in a production build, where the virtual module is resolved to a standard, bundled module.

1.  **Setup**: The test will build the playground for production and serve the output.
2.  **Assertion**: It will navigate to a page and verify that the `requestInfo` API functions as expected, confirming that the state module is correctly bundled and initialized.

### `testDev`: Verifying Server Action Mutations

**Finding (14 Oct 2025):** The initial approach of using local `file:` dependencies in the playground is likely not a reliable way to test Vite's re-optimization. Vite's dependency scanner is sophisticated enough to traverse these symlinked packages at startup, meaning the dependencies are not truly "undiscovered." This prevents a re-optimization from being triggered, invalidating the test.

**Revised Plan:** To create a more robust test, the playground will be refactored to use three distinct, small, external npm packages (e.g., `is-odd`, `is-even`, `is-number`) in place of the local `packages/` directory. This guarantees that when the components are imported mid-session, their dependencies are genuinely new to Vite, forcing the re-optimization we need to verify.

**Finding (14 Oct 2025):** The revised plan of programmatically adding dependencies to `package.json` and running `pnpm install` mid-session is also not an ideal simulation. It's a heavy-handed approach that doesn't accurately reflect the most common cause of re-optimization: the discovery of a *pre-existing* but previously unused import path. The most problematic scenario we've observed is when a developer adds a new component or server action that imports a new dependency, which triggers a re-optimization and breaks the `requestInfo` state within that action.

**Final Plan:** The most accurate way to simulate this is to start the application in a state where dynamic components and their underlying dependencies are commented out. The E2E test will then programmatically uncomment these lines of code at specific moments, forcing Vite to discover new import graphs and trigger re-optimization just before the feature is used. This precisely mimics the problematic developer workflow.

The test will also be updated to verify that `requestInfo` can be mutated by server-side logic after a re-optimization. The server action will use `requestInfo` to set a custom response header. The test will assert that this header is present in the response, confirming that the `requestInfo` object is not stale and is still connected to the current request context.

This refined approach provides a much more realistic and targeted verification of the solution's resilience.

### Log Analysis and Core Implication

The analysis of logs from our instrumented plugins provided the following key observations:

- **SSR re-optimization fires mid-load chain:** While our `ssrBridgePlugin`'s `load` hook is processing and transforming `ClientComponent.tsx`, the call to fetch its `is-number` dependency triggers the SSR optimizer. Vite logs "new dependencies optimized: is-number" and then "optimized dependencies changed. reloading" *during* our `load` hook's execution.
- **Stale version hash is embedded before re-optimization completes:** The transform for `ClientComponent.tsx` resolves dependencies like `react` to their optimized path, including the current version hash (e.g., `react.js?v=OLD_HASH`). It bakes this URL into the transformed code.
- **The importer's transform does not re-run:** After the optimizer completes and the new hash (`?v=NEW_HASH`) is available, the original `load` for `ClientComponent.tsx` continues. It does not re-run. Its cached `transformResult` still contains the old, stale URL.
- **The root cause is the stale transform, not a stale fetch:** The failure happens when the server-side render proceeds and tries to load `react?v=OLD_HASH`. The error is correct; that version is no longer the latest. The core issue is that the code for `ClientComponent.tsx` was generated moments too early and is now pointing to a non-existent version.

This analysis confirms that any solution must address the stale *importer* module, not just the dependency it's trying to fetch.

### New Attempt: Stripping Version Hashes

The new hypothesis is that if we can't control the timing, we can control the URL. The proposed solution is to tactically fix the stale reference at the last possible moment.

1.  **The Trigger:** Inside the `ssrBridgePlugin`'s `load` hook, when handling a virtual module ID that resolves to a pre-bundled SSR dependency (a path containing `/.vite/deps_ssr/`).
2.  **The Action:** We will strip the `?v=...` version hash from the URL before passing it to `fetchModule`.
3.  **The Goal:** The expectation is that Vite's `fetchModule`, when called with a base path without a version query, will resolve to the latest available version of that pre-bundled dependency. This would allow our in-flight `load` process to retrieve the post-optimization asset instead of failing on the stale hash it originally resolved.

This finding means that even if we could force `fetchModule` to provide stale content, the runner would likely reject it anyway. Our point of intervention must be different.

### Refined Reactive Approach: Catch, Invalidate, and Retry

A previous reactive approach was considered but discarded due to an imprecise understanding of the execution flow. A more detailed analysis, prompted by user feedback, clarifies the viability of a "Catch, Invalidate, and Retry" strategy.

#### The Problem Revisited
The "stale pre-bundle" error originates from the Vite Module Runner during the evaluation phase, which is a synchronous part of the `fetchModule` call stack. This allows the error to be caught. The challenge is that simply failing the render is not a solution, as the server-side process would crash without a graceful recovery mechanism.

#### The Refined Plan
The refined plan uses the caught error as a perfectly-timed signal to transparently recover within a single `load` hook execution.

1.  **The Trigger:** The call to `devServer.environments.ssr.fetchModule()` inside our `ssrBridgePlugin`'s `load` hook is wrapped in a `try...catch` block. The server-side render process that initiated this `load` is paused, awaiting a result.
2.  **The Signal:** We specifically catch the "stale pre-bundle" error.
3.  **The Action:** Upon catching this specific error, we perform a comprehensive invalidation of the `ssr` module graph to purge all stale `transformResult` entries.
4.  **The Recovery:** Immediately after invalidating, from within the same `catch` block, we **retry** the `fetchModule` call.
    *   Because the module graph is now clean, this second attempt will re-run the entire load-and-transform pipeline.
    *   By this time, the dependency optimizer has finished its work, so the transform will embed the correct, new version hashes for all dependencies.
    *   This second attempt is expected to succeed.
5.  **The Outcome:** The `load` hook successfully returns the result from the retried `fetchModule` call. The original server-side render process, which was awaiting this result, un-pauses and continues with the correct, consistent module code. The entire recovery is transparent to the renderer, manifesting only as a slight delay.
