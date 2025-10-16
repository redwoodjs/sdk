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

### Back to Basics: General Hash Stripping

**Finding:** The targeted hash stripping for `rwsdk/__ssr_bridge` was insufficient. Logs confirm that the "stale pre-bundle" error can occur for *any* pre-bundled dependency (e.g., `react.js`) after a re-optimization. The problem is systemic, not specific to a single module.

**Hypothesis:** The user's original hypothesis was correct. By stripping the version hash from *any* module ID passed to `fetchModule` within the `ssrBridgePlugin`'s `load` hook, we can proactively prevent the "stale pre-bundle" error entirely, as Vite will always resolve the base path to the latest optimized version. The complex reactive error handling in `dependencyOptimizationOrchestrationPlugin` should become unnecessary, acting only as a fail-safe.

1.  **The Hook:** The `load` hook within `ssrBridgePlugin.mts`.
2.  **The Action:** If a version hash is found on *any* module's ID, strip it before calling `fetchModule`.

### The Proactive Plan: Monkey-Patching the Optimizers

**Final Finding:** All reactive strategies have failed. The core issue is a race condition where an HTTP request is processed while a dependency re-optimization is in progress. By the time an error is thrown, the server's state is unrecoverably corrupt, and no amount of invalidation can reliably fix it. The only robust solution is to prevent the race condition from happening in the first place.

**Hypothesis:** By intercepting the call that triggers a re-optimization, we can pause all incoming HTTP requests until the optimization is fully complete. This ensures that no request is ever processed during the fragile, intermediate state, thus preventing both "stale pre-bundle" and "React runtime mismatch" errors.

This plan uses monkey-patching to create the "optimization in progress" signal that Vite does not natively provide.

1.  **The Hook:** The `configureServer` hook in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **Shared State:** A `Set` named `activeOptimizationPromises` will be used to track in-flight optimization runs across all three Vite environments (`ssr`, `client`, `worker`).
3.  **The Monkey-Patch:** The `registerMissingImport` method on each of the three dependency optimizers will be wrapped.
4.  **Wrapper Logic:**
    a.  When our wrapper for `registerMissingImport` is called, it will create a new promise and add it to the `activeOptimizationPromises` `Set`.
    b.  It will then call the original `registerMissingImport` function.
    c.  When the original function's promise settles (completes or fails), the corresponding promise will be removed from the `activeOptimizationPromises` `Set`.
5.  **The Middleware:** A standard, non-error-handling middleware will be placed at the top of the server's stack.
    a.  On every incoming request, it will check if the `activeOptimizationPromises` `Set` is empty.
    b.  If the set is not empty, it will `await Promise.all([...activeOptimizationPromises])`, effectively pausing the request until all concurrent re-optimizations are finished.
    c.  Once all promises are resolved, it calls `next()` to allow the request to proceed to a now-stable server.
 
 ### Finding: Cross-Environment Staleness is the Root Cause
 
 Analysis of the stack trace when the "new version of the pre-bundle" error is correctly caught reveals the true nature of the problem:
 
 1.  A dependency re-optimization is triggered in the **`ssr` environment**. This is often logged by Vite with the message "optimized dependencies changed. reloading".
 2.  The **`worker` environment** is not immediately aware of this change. A module within the worker's graph (e.g., `sdk/dist/runtime/imports/worker.js`) holds a stale reference to an `ssr` dependency (like `rwsdk/__ssr_bridge`) that was resolved using the *old* version hash.
 3.  When the worker's code executes, its stale import triggers a request for the old SSR dependency. The SSR environment correctly rejects this, throwing the "new version of the pre-bundle" error.
 
 The root cause is a state synchronization failure between Vite's `ssr` and `worker` environments. When the `ssr` environment changes, the `worker` environment must also be updated to prevent it from using stale, cached information.
 
 ### The "Blunt Hammer" Plan: Forcing Worker Synchronization
 
 Based on the cross-environment finding, the most direct solution is to force the stale environment (`worker`) to synchronize its state after the `ssr` environment changes.
 
 1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
 2.  **The Detection:** Catch the "new version of the pre-bundle" error.
 3.  **The Action:** Upon catching the error, execute a comprehensive reset:
     a.  **Invalidate All Module Graphs:** Call `invalidateAll()` on the `ssr`, `worker`, and `client` module graphs to clear all cached transformed modules.
     b.  **Force Worker Optimizer Re-run:** Call `server.environments.worker.depsOptimizer.run()`. This is the critical step that forces the worker's optimizer to re-evaluate its dependency state, synchronizing it with the now-updated `ssr` environment.
     c.  **Suspend Request:** Suspend the original, failed request.
 
 #### Key Assumptions and Considerations:
 
 *   **Race Conditions:** A race condition between optimizer runs is considered unlikely. The error we catch is a signal that the `ssr` optimization has already completed. Our subsequent call to `worker.depsOptimizer.run()` is a reaction to this completed event, not a concurrent operation.
 *   **Client-Side Reload:** It is not guaranteed that an `ssr` re-optimization will always trigger a `full-reload` HMR signal to the client. The initial implementation will rely on Vite's default behavior. If the browser does not reload consistently, we may need to manually send an HMR signal (`server.hot.send({ type: 'full-reload' })`) as a future enhancement.
 
 ### Finding: "Blunt Hammer" Fails Due to Optimizer Lifecycle
 
 The "Blunt Hammer" approach of forcing the worker's dependency optimizer to `run()` after an SSR optimization did not solve the issue. The logs show that even after explicitly triggering the worker's optimizer, the subsequent request immediately fails with the same "new version of the pre-bundle" error.
 
 This indicates a deeper issue with the optimizer's lifecycle. Our `run()` call triggers a new optimization, but there is no mechanism to `await` its completion. The suspended request is released by the browser's reload, and it hits the server while the worker optimization is still in-flight, leading to the same race condition. Without a reliable hook to know when the worker's optimization is complete, this approach is not viable.
 
 ### The Surgical Plan: Proactive and Reactive Fixes in the SSR Bridge
 
 We are pivoting back to a more surgical approach within the `ssrBridgePlugin.mts` `load` hook, combining proactive prevention with reactive recovery.
 
 1.  **Proactive Hash-Stripping for the SSR Bridge:** The most critical point of failure is the `rwsdk/__ssr_bridge` module itself. We will proactively prevent errors for this module.
     -   **Detection:** Before fetching a module, we will check if its ID matches the pattern for an optimized SSR bridge (e.g., contains `deps_ssr/rwsdk___ssr_bridge`).
     -   **Action:** If it matches, we will strip the `?v=...` version hash from the ID. This ensures we always request the latest version of the bridge, preventing the error for this specific module without risking the React runtime mismatch we've seen with other dependencies.
 
 2.  **Reactive Invalidation for All Other Dependencies:** For any other dependency (like `react`) that throws a "stale pre-bundle" error, we will accept that the current render is unsalvageable and focus on resetting the server's state for the next request.
     -   **Detection:** The `fetchModule` call will be wrapped in a `try...catch` block.
     -   **Action:** If a "new version of the pre-bundle" error is caught, we will invalidate the module graphs for the `worker` and `ssr` environments to clear their stale state. The error will then be re-thrown to fail the current request, allowing Vite's native HMR to trigger a page reload which will act as the clean, recovered request.
 
 This two-part strategy addresses the most common failure point (the bridge) proactively, while providing a robust reactive fallback for all other dependencies.
 
 ### Finding: Suspension Leads to Indefinite Hang
 
 The "Synthesized Plan" successfully prevents server crashes. When a "stale pre-bundle" error occurs, the middleware catches it, invalidates the `worker` and `ssr` module graphs, and suspends the request. This works as intended on the server-side, and no errors are thrown to the client.
 
 However, the client-side recovery is unreliable. The expected `full-reload` HMR signal from Vite does not seem to trigger consistently. This results in the user's browser hanging indefinitely—either on a blank screen during an HMR update or in a never-ending page load.
 
 ### The Redirect Plan: A More Robust Server-Side Reload Trigger
 
 **Hypothesis:** Relying on a client-side HMR connection for recovery is fragile. It may fail if the error happens on an initial page load before the HMR client has connected. A more robust solution is to use a server-side mechanism to force the client to reload.
 
 We previously attempted a server-side redirect, but it resulted in an infinite loop. Our hypothesis now is that this loop was caused by the `rwsdk___ssr_bridge` stale hash issue, which our proactive `resolveId` fix has since solved. With that root cause of the loop eliminated, a redirect is a viable strategy again.
 
 **The Plan:**
 
 1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
 2.  **The Detection:** Catch the "new version of the pre-bundle" error.
 3.  **The Action:**
     a.  **Invalidate Graphs:** Invalidate the `worker` and `ssr` module graphs as before to prepare the server for a clean request.
     b.  **Issue Redirect:** Instead of suspending the request, send an HTTP 307 (Temporary Redirect) response back to the client, redirecting to the same `req.url`. This instructs the browser to re-request the page, effectively forcing a full reload.
 
 ### Finding: Infinite Reload Loop Returns; `resolveId` Fix is Bypassed
 
 The redirect plan has failed and re-introduced the infinite reload loop. A deeper analysis of the logs reveals a critical flaw in the previous hypothesis:
 
 - The logs confirm that the middleware is catching the "stale pre-bundle" error and issuing redirects.
 - However, our proactive hash-stripping logic in the `ssrBridgePlugin`'s `resolveId` hook is **never being called**.
 
 This proves that the stale module ID for the `rwsdk___ssr_bridge` is being generated and cached in a way that bypasses our `resolveId` hook. The most likely culprit is an internal resolution that happens inside `devServer.environments.ssr.fetchModule()`. The staleness is introduced somewhere between the entry to our `load` hook and the point where Vite's internal logic throws the error.
 
 Our next step is to analyze a full stack trace from the error to pinpoint exactly where this internal resolution is occurring.
 
 ### Finding: The `CustomModuleRunner` Cache is the True Source of Staleness
 
 The stack trace from the "stale pre-bundle" error provides the definitive clue:
 
 ```
 at CustomModuleRunner.cachedModule (runner-worker/index.js:1283:22)
 at request (runner-worker/index.js:1134:86)
 at null.<anonymous> (/Users/justin/rw/worktrees/sdk_optimize-dep_resilience/sdk/dist/runtime/imports/worker.js:1:1)
 ```
 
 This reveals that the error is not originating from Vite's core module loading, but from a `CustomModuleRunner`. This runner is part of `vite-plugin-cloudflare` and implements its own caching layer (`cachedModule`).
 
 This is the root cause of our problems. All of our attempts to invalidate Vite's internal module graph (`server.environments.worker.moduleGraph.invalidateAll()`) were having no effect because the truly stale module was being served from this external, custom cache. The `CustomModuleRunner` was holding onto an old, transformed version of `sdk/dist/runtime/imports/worker.js`, which contained the stale import for the `ssr_bridge`.
 
 ### New Investigation: Invalidating the `CustomModuleRunner` Cache
 
 The problem is now redefined. We are no longer fighting Vite's cache, but Cloudflare's. The next step is to investigate the `vite-plugin-cloudflare` source code, specifically the `CustomModuleRunner`, to understand its caching mechanism and, most importantly, to find the API or event that is used to invalidate it. A mechanism for cache invalidation must exist, otherwise no dependency re-optimization would ever work in a Cloudflare/Vite project. Our goal is to find this mechanism and call it from our error-handling middleware.

### Finding: The `vite-plugin-cloudflare` Invalidation Mechanism

An analysis of the `vite-plugin-cloudflare` source code (`miniflare-options.ts`) reveals the intended cache invalidation mechanism. The `CustomModuleRunner` does not handle invalidation itself. Instead, it uses a service binding (`__VITE_INVOKE_MODULE__`) to proxy HMR events and module requests back to the main Vite server's `devEnvironment.hot.handleInvoke` API.

In theory, when we call `moduleGraph.invalidateAll()`, Vite should send an HMR message that is received by the `CustomModuleRunner` and passed back to the Vite dev environment, which should then purge the stale module from the `evaluatedModules` cache.

The fact that we are stuck in an infinite loop proves this chain is broken. The `CustomModuleRunner`'s cache is not being correctly purged, and it continues to serve a stale module that triggers the error on every reload.

### The "Cache Buster" Experiment

To definitively prove that the `CustomModuleRunner`'s cache is the source of the loop, and to find a potential workaround, we will implement a cache-busting strategy.

**Hypothesis:** By appending a unique query parameter to the URL during our server-side redirect, we can force all intermediate caches (including the `CustomModuleRunner`) to treat the request as a new, uncached entry. This will bypass the stale cache and force a re-fetch from the now-clean Vite module graph. This approach has been superseded by the `fetchModule({ cached: false })` plan.

**The Plan:**

1.  **The Hook:** The 4-argument error middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **The Detection:** Catch the "new version of the pre-bundle" error.
3.  **The Action:**
    a.  **Invalidate Graphs:** Invalidate the `worker` and `ssr` module graphs.
    b.  **Issue Cache-Busting Redirect:** Send an HTTP 307 redirect, but this time to a modified URL. It will append a unique query parameter (e.g., `?stale-cache-bust=<timestamp>`) to the existing `req.url`. This ensures the re-request is seen as a new, unique URL by all caching layers.

### Corrected Understanding of the Invalidation Chain

Previous analysis incorrectly stated that the `ModuleRunner` itself contained the logic for handling a `full-reload`. The correct mechanism is a chain of events that passes the HMR message from the Vite server to the Cloudflare runner.

Here is the step-by-step flow for a standard `vite-plugin-cloudflare` project:

1.  **The Trigger (Vite Core):** A file change triggers a dependency re-optimization. Upon completion, Vite's `DepsOptimizer` broadcasts a `{ type: 'full-reload' }` message to all connected HMR clients. This happens inside `packages/vite/src/node/optimizer/optimizer.ts` in the `fullReload()` function.

2.  **Runner Receives HMR Message (`vite-plugin-cloudflare`):** The `__VITE_RUNNER_OBJECT__`, a Durable Object living inside Miniflare, maintains an active WebSocket connection to the Vite dev server. Its listener receives the `full-reload` message.
    -   *File:* `packages/vite-plugin-cloudflare/src/runner-worker/module-runner.ts`
    -   *Code:* `webSocket.addEventListener("message", ...)`

3.  **HMR Handler is Invoked (Vite Core):** The WebSocket listener passes the parsed message to an `onMessage` handler. This handler was created and passed to the runner's transport when it was initialized.
    -   *File:* `packages/vite/src/module-runner/runner.ts`
    -   *Code:* `this.transport.connect(createHMRHandlerForRunner(this))`

4.  **`full-reload` is Processed (Vite Core):** The HMR handler contains the specific logic for each message type. For a `full-reload`, it identifies all module entrypoints and then calls `runner.evaluatedModules.clear()`.
    -   *File:* `packages/vite/src/module-runner/hmrHandler.ts`
    -   *Code:* Inside the `case 'full-reload':` block.

5.  **Cache is Cleared (Vite Core):** The `runner.evaluatedModules.clear()` call purges all modules from the `CustomModuleRunner`'s internal cache.

This confirms that `vite-plugin-cloudflare` is designed to have its cache cleared automatically via Vite's standard HMR `full-reload` event. Our infinite loop is definitive proof that this communication chain is breaking down in our multi-environment setup.

### The `cached: false` Plan

**Hypothesis:** Instead of trying to fix the broken HMR invalidation chain from the outside, we can bypass the problem from the inside. The `devServer.environments.ssr.fetchModule` method accepts a `cached: boolean` option. By explicitly calling it with `{ cached: false }`, we can instruct Vite to ignore its module graph cache and unconditionally re-fetch and re-transform the module. This should give us the fresh version and break the loop.

**The Plan:**

1.  **The Hook:** The `load` hook of our `ssrBridgePlugin.mts`.
2.  **The Action:** Modify the `fetchModule` call to always pass `{ cached: false }` as the third argument. This will be a temporary measure to test the hypothesis. If it works, we can develop a more nuanced strategy, but for now, it serves as a crucial diagnostic test.

### Finding: HMR Invalidation is Not Propagating to the SSR Environment

The `cached: false` experiment is underway. The core hypothesis is that the `full-reload` HMR event is successfully clearing the cache of the **worker** environment's `CustomModuleRunner`, but this invalidation is not propagating to the separate **SSR** environment.

When our `ssrBridgePlugin` calls `devServer.environments.ssr.fetchModule()`, it is accessing the SSR environment's module graph directly. Since this environment never receives the invalidation event, it continues to serve stale modules from its cache, which is the root cause of the "stale pre-bundle" error and the subsequent infinite reload loop.

This leads to two potential long-term solutions:

1.  **Propagate HMR Events:** Find a way to forward HMR events received by the worker environment to the SSR environment, so its cache is cleared correctly.
2.  **Disable SSR Caching:** Intentionally bypass the SSR cache using `{ cached: false }`. This might be a viable strategy if the worker environment's caching of our virtual modules (`virtual:rwsdk:ssr:*`) is sufficient to prevent performance degradation. The ongoing test will provide the first piece of evidence for this. An open question remains: how frequently is our `load` hook called for the same module? If the worker's cache doesn't prevent repeated calls, this approach could be inefficient.
 
 ### Finding: `cached: false` is Ineffective, Root Problem is Worker's Runner Cache
 
 The test with `fetchModule({ cached: false })` did not solve the issue. The logs show the same infinite reload loop. This provided two critical insights:
 
 1.  **`fetchModule`'s Scope:** An investigation into Vite's source code reveals that `fetchModule`'s `cached` option only controls the `ModuleGraph` cache (the stored result of transforming a file). It has **no effect** on the `ModuleRunner`'s separate, internal `evaluatedModules` cache (the stored result of *executing* a file).
 2.  **The Real Culprit:** The error originates in the **worker's `CustomModuleRunner`**. It holds a stale, cached *execution result* for `react`. Our `fetchModule` call to the `ssr` environment was a red herring; the true source of stale state is the worker's own execution cache, which is not being cleared by the post-optimization `full-reload` HMR event.
 
 #### Unanswered Questions
 
 This leaves us with two core mysteries:
 
 1.  **Why isn't the worker's cache clearing?** The `full-reload` event sent by Vite's optimizer is intended to clear the `CustomModuleRunner`'s cache. The logs prove this mechanism is failing, but we don't yet know why.
 2.  **Why does `rwsdk___ssr_bridge` become stale?** After the initial `react` error is caught and a redirect is issued, the browser reloads. The worker starts fresh, but because its cache was never cleared, it immediately tries to use its stale version of the `ssr_bridge`, perpetuating the loop.
 
 ### Plan: Propagate HMR Events
 
 The next logical step is to address the architectural gap between the two environments. If the SSR environment is not aware of HMR events happening in the worker, its state can become desynchronized. We will attempt to manually forward HMR events.
 
 **The Plan:**
 
 1.  **The Hook:** Use the `configureServer` hook in `ssrBridgePlugin.mts`.
 2.  **The Action:** Listen for `full-reload` events on `server.environments.ssr.hot` and propagate them to `server.environments.worker.hot`. This should finally trigger the `clearCache()` method on the correct `CustomModuleRunner`, resolving the stale state.
 
 ### Breakthrough: The Direction of Invalidation is Reversed
 
 The previous attempt failed because the fundamental assumption about HMR event flow was incorrect.
 
 1.  **The Trigger is SSR:** The logs clearly show that dependency optimization and the subsequent "reloading" message originate from the `ssr` environment. Therefore, the `full-reload` event is dispatched from `server.environments.ssr.hot`.
 2.  **The Cache is in the Worker:** There is no module runner used for the `ssr` environment in our architecture. Modules are only *fetched* from it. The actual code *evaluation* and caching of the executed result happens exclusively within the **worker's `CustomModuleRunner`**.
 
 This means the HMR propagation must flow from **SSR to Worker**, not the other way around. The goal is to inform the worker's runner that its cache is stale because the SSR dependencies it relies on have changed.
 
 **The Corrected Plan:**
 
 1.  **The Hook:** Use the `configureServer` hook in `ssrBridgePlugin.mts`.
 2.  **The Action:** Listen for `full-reload` events on `server.environments.ssr.hot` and propagate them to `server.environments.worker.hot`. This should finally trigger the `clearCache()` method on the correct `CustomModuleRunner`, resolving the stale state.
