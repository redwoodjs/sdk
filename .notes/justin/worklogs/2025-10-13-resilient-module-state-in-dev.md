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

When `ClientComponent.tsx` is modified while it has no importers (step 2 of the failing scenario), `isInUseClientGraph` returns `false`. Our plugin then incorrectly tells Vite to ignore the update for the client and SSR environments.

Later, when `Home.tsx` is modified to import `ClientComponent.tsx`, the `ssr` environment finally processes the component, discovers the `is-number` dependency, and runs its optimizer. However, because the client environment was told to ignore the initial change, it never runs its own optimizer and never gets the `full-reload` HMR signal. This leaves the client and server out of sync regarding their dependency bundles, causing the pre-bundle error on the next server render.

### Revised Plan

The previous approach of trying to fix HMR logic was incorrect, as the error originates from stale modules in the SSR graph after a dependency re-optimization. The key signal for a re-optimization is the `full-reload` HMR event.

The new plan is to make our system react to this signal directly:

1.  In `ssrBridgePlugin.mts`, listen for the `full-reload` HMR event on all three Vite environments (`client`, `ssr`, and `worker`).
2.  When this event is detected in *any* environment, it signifies a state where module graphs may be out of sync.
3.  In response, we will perform a broad invalidation of all modules related to the SSR bridge within our `worker` environment's module graph. This ensures that any subsequent request will be forced to re-fetch the fresh, re-optimized modules, preventing the "stale pre-bundle" error.
4.  Crucially, we will also invalidate the **entire module graph** of the `ssr` environment itself. This ensures that the source of the bridged modules is also completely fresh, eliminating any possibility of the worker pulling in stale code from a cached, out-of-date SSR environment.

This proactive approach ensures that before any new server-side render can occur, our entire SSR-related module caching is purged, forcing the system to use the new, correctly optimized dependencies.

### Final Approach (Revised Again): Monkey-Patching Vite's Optimizer

Analysis of the Vite source code (`packages/vite/src/node/optimizer/optimizer.ts`) revealed that listening for the `full-reload` HMR event is still too late. A request can race ahead of the HMR listener and hit a stale module graph.

The most reliable solution is to intercept the re-optimization process at an even earlier stage.

1.  **The Trigger:** The internal `fullReload` function within Vite's SSR dependency optimizer (`depsOptimizer`) is called immediately after a re-optimization is committed and just before the HMR message is sent. This is the earliest and most precise moment to intervene.
2.  **The Implementation:** We will "monkey-patch" this function. In our `miniflareHMRPlugin.mts`, during the `configureServer` hook, we will:
    a.  Get a reference to the `ssr` environment's internal `depsOptimizer` object.
    b.  Store a reference to its original `fullReload` method.
    c.  Replace `depsOptimizer.fullReload` with our own wrapper function.
3.  **The Action:** Our wrapper function will execute our logic first, and then call the original function to let Vite proceed. The order is critical:
    a.  First, perform our comprehensive invalidation of the `ssr` module graph and the `worker`'s virtual SSR subgraph.
    b.  Then, call the original `fullReload` function, which will invalidate the `ssr` graph again (this is harmless) and send the HMR message to the client.

This monkey-patching approach guarantees that our invalidation runs *before* Vite sends the `full-reload` signal, completely eliminating the race condition.

### Investigation: Why Proactive Invalidation Fails

The previous attempts to proactively invalidate the module graphs based on the `full-reload` HMR event were unsuccessful. A deeper analysis of the Vite source code (`packages/vite/src/node/optimizer/optimizer.ts`) revealed a subtle but critical race condition.

1.  **The Event Sequence:** When Vite's dependency optimizer completes a re-bundle, it calls an internal function, `fullReload()`.
2.  **The Race Condition:** This `fullReload` function performs two actions in sequence:
    a.  First, it invalidates the module graph for its *own* environment (in our case, the `ssr` environment).
    b.  Second, it sends the `full-reload` HMR message over the websocket.
3.  **The Flaw:** Our previous approach was to listen for the `full-reload` HMR message. However, there is a window of time between step (a) and step (b). If a new HTTP request for a server-side render arrives in this window, it can hit our `ssrBridgePlugin` *before* our HMR listener has a chance to run and invalidate the other stale graphs (like the `worker`'s virtual SSR subgraph). The `worker` graph still holds references to old, now-invalidated `ssr` modules, leading to the "stale pre-bundle" error.

This explains why listening for the HMR event is fundamentally unreliable for this purpose. We are acting on the signal too late.

### New Hypothesis and Investigation Path

The new hypothesis is that we should treat the virtual SSR modules as cheap, stateless proxies that should perhaps never be cached by the `worker` environment's module graph, or should be invalidated much more aggressively.

The core challenge, as we've seen, is that simply calling `fetchModule` with `{ cached: false }` was not sufficient to resolve the issue. This suggests that the stale reference is not in the `fetchModule` cache itself, but higher up in the module graph—specifically, in the module that is *importing* the stale dependency. Even if `fetchModule` could get a fresh copy of `react`, the `ClientComponent` module that imports it might not be re-evaluated, and thus it continues to hold a reference to the old, stale version hash.

Before attempting another solution, we need to investigate and understand this behavior. The next step is to gather more data by adding debugging logs to trace the lifecycle of these modules during a re-optimization. We need to answer:

1.  When a re-optimization happens, is the `load` hook in `ssrBridgePlugin` being called again for the module that imports the stale dependency (e.g., `ClientComponent.tsx`)?
2.  What is the sequence of HMR events, module invalidations, and `load` hook executions?

By logging this information, we can build a clear picture of the caching and invalidation behavior and identify the precise point of failure.

### New Attempt: Stripping Version Hashes

The log analysis confirmed a race condition: our `ssrBridgePlugin`'s `load` hook for an importer (e.g., `ClientComponent.tsx`) executes and transforms its code, embedding version hashes for its dependencies (e.g., `react?v=OLD_HASH`). During this same `load` execution, a nested `fetchModule` for a new dependency (`is-number`) can trigger the SSR optimizer. The optimizer completes, creating a `react?v=NEW_HASH`, but by then the importer's code has already been generated with the old hash. The importer is not invalidated or re-run, so it proceeds to make a request for the stale URL, causing the crash.

The new hypothesis is that if we can't control the timing, we can control the URL. The proposed solution is to tactically fix the stale reference at the last possible moment.

1.  **The Trigger:** Inside the `ssrBridgePlugin`'s `load` hook, when handling a virtual module ID that resolves to a pre-bundled SSR dependency (a path containing `/.vite/deps_ssr/`).
2.  **The Action:** We will strip the `?v=...` version hash from the URL before passing it to `fetchModule`.
3.  **The Goal:** The expectation is that Vite's `fetchModule`, when called with a base path without a version query, will resolve to the latest available version of that pre-bundled dependency. This would allow our in-flight `load` process to retrieve the post-optimization asset instead of failing on the stale hash it originally resolved.
