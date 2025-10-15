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

### Finding: In-Flight Renders are Unsalvageable (Confirmed)

The "Catch, Invalidate, and Silence" approach also failed, producing the same `TypeError: Cannot read properties of null (reading 'useState')` error.

This definitively proves the core problem: any server-side render that is in-flight when a dependency re-optimization occurs is fundamentally unsalvageable. Even if we prevent the "stale pre-bundle" error from crashing the process by returning an empty module, the React renderer's internal state is already inconsistent with the dependency graph. The old renderer tries to work with a module graph that has partially moved on, leading to an unrecoverable runtime error. Any attempt to patch a doomed render at the module level will fail.

### The High-Level Retry Strategy: Middleware Interception

The only robust solution is to operate at a higher level. Instead of trying to save or silence the doomed in-flight render, we must abort it cleanly at the HTTP level and let the browser initiate a completely new render.

The plan is to leverage a custom Vite middleware to intercept the failure and manage the recovery cycle:

1.  **The Hook:** A custom middleware will be added to the Vite dev server, positioned at the beginning of the stack to act as a top-level error handler. The `configureServer` hook will return a function, which Vite executes after other middlewares are added. This is the correct pattern for registering a final, top-level error handler.
2.  **The Detection:** This middleware will be a standard Connect error-handling middleware with four arguments (`err, req, res, next`). It will inspect the `err` object to look for the "stale pre-bundle" message.
3.  **The Server-Side Action:** Upon catching the error, the middleware will:
    a.  **Prepare for the Retry:** Invalidate the entire SSR module graph to purge all stale cached transformations and ensure the server is ready for a clean request.
    b.  **Abort Gracefully:** Take control of the response and end it immediately with a neutral status (e.g., 204 No Content). This prevents Vite from sending its default 500 error overlay to the browser. If the error is not the one we're looking for, it will be passed to `next(err)` for Vite's default handler to process.
4.  **The Client-Side Recovery:** In parallel, Vite's optimizer has already sent a `full-reload` HMR signal to the client. The browser receives this signal and reloads the page. This reload acts as our "retried request," hitting a server that has just been cleaned and is ready to serve a consistent, post-optimization response.

This "Intercept -> Invalidate -> Abort -> Reload" cycle accepts the failure of the in-flight render and uses a high-level mechanism to ensure a smooth, automatic recovery without ever showing an error to the user.

### Finding: Middleware Abort Leads to Blank Page

Testing the middleware interception strategy revealed new behavior:

1.  Our top-level error-handling middleware successfully caught the "stale pre-bundle" error.
2.  It invalidated the SSR module graph as planned.
3.  It ended the response with a `204 No Content` status code, preventing Vite's 500 error overlay from appearing.

However, this resulted in the browser displaying a blank white page. The browser console showed an `Error: Connection closed.` message. Crucially, the server logs indicated that only the `ssr` dependency optimizer ran; the `client` optimizer did not.

This suggests that by sending a `204`, we are short-circuiting a part of Vite's client-side processing. The client receives the `full-reload` HMR signal, but the aborted request seems to interfere with its ability to properly act on it.

### Finding: Redirect Leads to Loop

Manual testing of the server-side redirect strategy revealed a new issue: upon triggering the re-optimization, the browser entered an infinite redirect loop.

This suggests that the server gets stuck in a state where it repeatedly detects a stale bundle and issues a redirect, but the client's subsequent request hits the server before the state is fully resolved, triggering the same error again. A server-side redirect is not the correct mechanism.

### The Vite-Native Approach: Triggering HMR from the Server

Instead of imitating Vite's client-side behavior (a reload) with a server-side equivalent (a redirect), a more direct approach is to use Vite's own server-side API to trigger the client-side behavior.

The `ViteDevServer` instance, which is available in our `configureServer` hook, has a websocket interface (`server.hot`) that can be used to send HMR messages directly to the client.

1.  **The Hook:** The existing error-handling middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **The Detection:** Catch the "stale pre-bundle" error.
3.  **The Action:** Upon catching the error, the middleware will:
    a.  **Prepare for the Retry:** Invalidate the entire SSR module graph.
    b.  **Trigger the Reload:** Call `server.hot.send({ type: 'full-reload' })`. This uses Vite's own HMR mechanism to instruct the client to reload the page.
    c.  **Suspend the Response with a Timeout:** The middleware will do nothing further for a short period (e.g., 500ms). This leaves the original, doomed HTTP request hanging long enough for the client to process the HMR signal and initiate a page reload, which will naturally cancel the hanging request. If the client does not cancel the request within the timeout, a `204 No Content` response will be sent to prevent an infinite hang.

**Finding: Infinite Reload Loop**

Manual testing of the "Suspend and Reload" strategy revealed a new issue: the browser gets stuck in an infinite reload loop. This suggests that the server-side invalidation is not comprehensive enough. While the `ssr` graph is cleared, some part of the `worker` graph may retain a stale reference, causing the reloaded request to hit the same error, which triggers another reload, ad infinitum.

### The Most Comprehensive Plan Yet

This plan combines all previous learnings.

1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **The Detection:** Catch the "stale pre-bundle" error.
3.  **The Action:** Upon catching the error, the middleware will execute a comprehensive recovery procedure:
    a.  **Comprehensive Invalidation:**
        *   Invalidate the **entire `ssr` module graph.**
        *   Trigger Reload:** Call `server.hot.send({ type: 'full-reload' })`.
        *   Suspend with Timeout:** Start a short timeout (e.g., 500ms). If the timeout completes before the browser cancels the request, end the response with a `204 No Content` as a fail-safe.

### The Final Comprehensive Plan

This plan combines all previous learnings into a single, robust strategy.

1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **The Detection:** Catch the "stale pre-bundle" error.
3.  **The Action:** Upon catching the error, the middleware will execute a comprehensive recovery procedure:
    a.  **Comprehensive Invalidation:**
        *   Invalidate the **entire `ssr` module graph.**
        *   Iterate through the **`worker` module graph** and invalidate any module whose URL begins with the `VIRTUAL_SSR_PREFIX`. This is critical for breaking the reload loop by purging all stale references from the worker environment.
    b.  **Trigger Reload:** Call `server.hot.send({ type: 'full-reload' })` to instruct the client to reload.
    c.  **Suspend with Timeout:** Start a short timeout (e.g., 500ms). If the client's reload does not cancel the hanging request within this time, the timeout will fire and end the response with a `204 No Content` as a fail-safe to prevent resource leaks.

### The "Less is More" Plan: Relying on Vite's Native HMR

**Hypothesis:** The infinite reload loop is caused by our own `server.hot.send({ type: 'full-reload' })` call. It may be interfering with Vite's native HMR signal that is already sent during re-optimization, potentially triggering a second, unnecessary optimization run which causes the loop to repeat.

This plan tests that hypothesis by removing our interventions and relying entirely on Vite's built-in recovery process.

1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **The Detection:** Catch the "stale pre-bundle" error.
3.  **The Action:** Upon catching the error, the middleware will do nothing except suspend the request.
    a.  **No Invalidation:** We will not invalidate any module graphs.
    b.  **No HMR Signal:** We will not send a `full-reload` HMR signal.
    c.  **Suspend Only:** The middleware will simply suspend the response with a timeout fail-safe. The theory is that Vite has already sent the necessary HMR signal to the client. The client's subsequent reload will cancel this hanging request naturally. This approach gracefully discards the failed request without interfering.

### The Hybrid Plan: Invalidate but Don't Manually Reload

**Hypothesis:** The "Less is More" plan failed because some server-side state *does* need to be reset after a re-optimization. However, our manual `server.hot.send({ type: 'full-reload' })` call might still be the cause of the reload loop.

This hybrid approach tests both parts of that hypothesis. We will re-introduce the comprehensive invalidation to reset the server's module graphs, but we will continue to omit the manual HMR signal, relying on Vite's native client reload.

1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **The Detection:** Catch the "stale pre-bundle" error.
3.  **The Action:**
    a.  **Comprehensive Invalidation:** Invalidate both the entire `ssr` module graph and all virtual SSR modules within the `worker` graph.
    b.  **No HMR Signal:** Do NOT send a `full-reload` signal.
    c.  **Suspend:** Suspend the response with a timeout fail-safe.

### The Explicit Invalidation Plan

**Hypothesis:** The previous invalidation attempts were insufficient because a) they may have been missing modules due to relying on URLs with stale hashes, and b) the `rwsdk/__ssr_bridge` module itself was not being properly invalidated in the worker graph, causing it to become the source of subsequent "stale pre-bundle" errors.

This plan uses a more robust and explicit invalidation strategy based on user insights.

1.  **The Hook:** The 4-argument error middleware.
2.  **The Detection:** Catch the "stale pre-bundle" error.
3.  **The Action:**
    a.  **Use `invalidateAll()` for SSR:** The entire SSR module graph will be cleared using `server.environments.ssr.moduleGraph.invalidateAll()` for maximum effectiveness.
    b.  **Targeted Invalidation for Worker:** The middleware will still iterate through the worker module graph to invalidate all modules prefixed with `VIRTUAL_SSR_PREFIX`.
    c.  **Explicitly Invalidate the Bridge:** Crucially, we will add a specific call to invalidate the `rwsdk/__ssr_bridge` module in the worker's graph by its clean ID, directly addressing the failure point observed in the logs.
    d.  **Suspend:** The request will be suspended, relying on Vite's native HMR.
