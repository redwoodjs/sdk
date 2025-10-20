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

**Hypothesis:** My original hypothesis was correct. By stripping the version hash from *any* module ID passed to `fetchModule` within the `ssrBridgePlugin`'s `load` hook, we can proactively prevent the "stale pre-bundle" error entirely, as Vite will always resolve the base path to the latest optimized version. The complex reactive error handling in `dependencyOptimizationOrchestrationPlugin` should become unnecessary, acting only as a fail-safe.

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
 
 ### Finding: `hot.on` is for Inbound Events, Interception of `hot.send` is Required
 
 The HMR propagation attempt failed again. The log message "Detected `full-reload`..." never appeared, confirming that the `hot.on('full-reload', ...)` listener is never called.
 
 The reason is a fundamental misunderstanding of Vite's HMR API:
 
 -   `hot.on()`: This method is for listening to **inbound** events sent *from* a client (via `import.meta.hot.send()`) to the server. It is not a hook for server-side event monitoring.
 -   `hot.send()`: This method is for **outbound** broadcasts *from* the server to its connected clients.
 
 The dependency optimizer calls `hot.send()`. Our listener was using `hot.on()`. The two are not connected.
 
 To solve this, we must intercept the `hot.send()` call itself. By wrapping the original method, we can inspect the outbound payloads, and when we see a `full-reload` event from the SSR environment, we can manually trigger a corresponding `full-reload` in the worker environment.
 
 **The Definitive Plan:**
 
 1.  **The Hook:** Use the `configureServer` hook in `ssrBridgePlugin.mts`.
 2.  **The Action:** Monkey-patch (wrap) the `server.environments.ssr.hot.send` method. The wrapper function will check for `full-reload` payloads, forward them to the `worker` environment's `hot.send`, and then call the original `send` method to preserve default behavior.
 
 ### Final Finding: An Unsalvageable Request, Not a Race Condition
 
 The previous theory about a race condition with the browser was incorrect, as the HMR client is the `CustomModuleRunner` itself, not a browser. `ssr.hot.send()` is a no-op as there is no client connected.
 
 The core issue is that the `full-reload` message sent to the worker's HMR channel is not preventing the stale error. This is because the original, in-flight request that triggered the optimization is already in a corrupted state and is unsalvageable. Sending an HMR message only prepares the server for *future* requests; it cannot save the current one.
 
 ### The Definitive Solution: Decouple State Reset and Request Retry
 
 We must handle the two concerns separately: resetting the server's state, and gracefully retrying the request.
 
 1.  **`ssrBridgePlugin.mts` (State Reset):** The `send` interceptor on the SSR HMR channel is the correct place to trigger a full-system reset. When a `full-reload` is detected, it will:
     *   Invalidate both the `worker` and `ssr` module graphs.
     *   Propagate the `full-reload` event to the worker's HMR channel to clear the `CustomModuleRunner`'s execution cache.
     *   It will **not** call the original `send`, as it's a no-op.
 2.  **`dependencyOptimizationOrchestrationPlugin.mts` (Request Retry):** An error-handling middleware is still required. It will catch the inevitable "stale pre-bundle" error from the unsalvageable in-flight request and respond with a `307 Temporary Redirect`, which instructs the client (in this case, the parent worker) to re-issue the same request.
 
 This creates a robust, ordered sequence: The server state is reset, the doomed request is gracefully terminated with a redirect, and the redirect triggers a fresh request against the now-clean server.
 
 ### Final Finding: The HMR Invalidation Chain is Broken
 
 The previous theory about an unsalvageable request, while partially true, was still missing the root cause. The latest tests, which involved re-enabling the redirect middleware, proved that even after a successful state reset and a fresh request, the `CustomModuleRunner`'s cache is *still* stale.
 
 This points to one unshakable conclusion: the `full-reload` HMR message we are propagating to the worker environment is not successfully triggering the `runner.clearCache()` method. The invalidation chain is broken somewhere inside the `vite-plugin-cloudflare` implementation.
 
 ### The Diagnostic Plan: Trace the HMR Message
 
 We must shift from implementing solutions to performing direct diagnostics. The plan is to add temporary logging statements inside the compiled `vite-plugin-cloudflare` code within `node_modules` to trace the HMR message's path and find where it breaks down.
 
 1.  **Log on Receive:** Add a log inside the `webSocket.addEventListener("message", ...)` handler to confirm the `full-reload` payload is arriving at the runner.
 2.  **Log in Handler:** Add a log inside the `case 'full-reload':` block within the HMR handler to confirm the payload is being correctly dispatched.
 3.  **Log on Clear:** Add a log inside the `runner.clearCache()` method to confirm it is being called.
 
 This will give us definitive proof of where the chain is broken.

### Attempt #11: Monkey-patch `vite-plugin-cloudflare` for diagnostics

**Hypothesis:** The `full-reload` HMR message is being correctly propagated to the worker's HMR channel, but the `CustomModuleRunner`'s internal `evaluatedModules` cache is not being cleared, causing it to retain stale module references.

**Plan:**
- Add `console.log` statements directly into the compiled `vite-plugin-cloudflare` code within `node_modules` at three key locations:
    1.  The WebSocket `message` event listener, to see the raw payload.
    2.  The `full-reload` case in the HMR handler, to see if it's dispatched.
    3.  The `runner.evaluatedModules.clear()` call, to confirm the cache is cleared.

**Findings:**
- After adding the logs and re-running the scenario, **none of the diagnostic logs appeared in the console**.
- This is a significant finding. It proves that the HMR message is not reaching the runner's WebSocket at all. The point of failure is earlier in the chain than hypothesized.

### Attempt #12: Verify HMR Client Connection

**Hypothesis:** The `server.environments.worker.hot.send()` call in the `ssrBridgePlugin` is a no-op because the `CustomModuleRunner`'s WebSocket is not registered as a client on the worker environment's WebSocket server (`server.environments.worker.ws`).

**Plan:**
- In the `ssrBridgePlugin.mts` monkey-patch, add a `console.log` to inspect `server.environments.worker.ws.clients.size` just before calling `send()`.
- If the size is 0, it confirms our hypothesis that there are no connected clients to send the HMR message to.
- If the size is greater than 0, it implies the message is being sent but dropped for another reason, which would require further investigation into Vite's HMR internals.

**Findings:**
- The `DevEnvironment` type does not have a `.ws` property. It has a `.hot` property, which is an abstraction (`NormalizedHotChannel`) based on an EventEmitter. The number of clients is not directly exposed.
- A `grep` for `.hot.on` in `vite-plugin-cloudflare`'s `dist/index.js` returned no results.
- A subsequent `grep` for `WebSocket` revealed the plugin's mechanism: it creates its own `WebSocketServer` and attaches to the underlying `httpServer`'s `'upgrade'` event. It directly proxies WebSocket connections to Miniflare, completely bypassing Vite's `hot` channel API.
- **This is the root cause:** The plugin never subscribes to Vite's HMR events on the server side, so our `worker.hot.send()` call has no listeners and does nothing.

**Correction & Revised Plan:**
- I corrected my previous assumption that the `hot` channel was being bypassed. The `DevEnvironment` API is designed to abstract the transport layer, so the `worker.hot.send()` call *should* be the correct method.
- The fact that no logs appeared in the runner is the most critical piece of evidence. The current plan is to re-run the test and confirm whether any messages are being logged in the runner's console now that we are sure the correct file has been instrumented.

### Attempt #13: Analyzing Runner Logs and Identifying the Race Condition

**Findings:**
- After correctly instrumenting `dist/runner-worker/index.js`, the logs confirmed that the `full-reload` HMR message is successfully received by the runner, the `full-reload` handler is triggered, and `runner.evaluatedModules.clear()` is called.
- However, an error is thrown immediately *after* the cache is cleared.
- The stack trace shows the error originates from the `for...of` loop inside the `full-reload` handler which attempts to immediately re-import all entry points (`await runner.import(url)`).

**Conclusion:**
- This reveals the root cause: a race condition. The runner clears its cache and immediately re-requests modules from the Vite server. However, the Vite server has not yet completed its own asynchronous dependency re-optimization process. The runner's request arrives too early, hits the server's stale dependency metadata, and triggers the "stale pre-bundle" error.

**Realization & The Missing Piece:**
- I remembered that a previous attempt to solve this using middleware and a 307 redirect resulted in a never-ending loop, where the `ssr_bridge` module was repeatedly reported as stale.
- The reason that loop occurred was that the `CustomModuleRunner`'s internal cache (`evaluatedModules`) was never being cleared. On every request after the redirect, the runner would use its stale cache to re-request the bridge with an old, invalid version hash, triggering the error again.
- Our successful diagnostic test has now proven that forwarding the `full-reload` HMR event is the key. It is the only mechanism that successfully clears the runner's internal cache, which was the missing piece in our previous attempts.

**Plan:**
- Modify the `full-reload` handler in `dist/runner-worker/index.js` to remove the aggressive re-import loop. Its sole responsibility should be to clear the `evaluatedModules` cache. The runner will then be in a clean state, ready for a subsequent request to re-populate its modules after the server has stabilized.

### Attempt #14: The Combined Solution - HMR Bridge and Middleware

**Plan:**
- **Do not modify `node_modules`.** The previous plan is invalid as it relies on patching a dependency.
- The correct solution is to combine two of our own plugins to work with the existing behavior of `vite-plugin-cloudflare`.
- **1. Keep the HMR Bridge (`ssrBridgePlugin.mts`):** The monkey-patch that forwards the `full-reload` event to the worker is essential. This is what clears the `CustomModuleRunner`'s internal cache, preventing the infinite loop.
- **2. Re-enable the Middleware (`dependencyOptimizationOrchestrationPlugin.mts`):** This middleware will act as a safety net. It will catch the one expected "stale pre-bundle" error that occurs during the runner's premature re-import and issue a 307 Temporary Redirect.
- This combination allows the runner's state to be cleared correctly while gracefully managing the inevitable race condition, giving the Vite server time to stabilize before the next request.

### Attempt #15: Proving the Race Condition with Granular Logging

**Correction:**
- I remembered that the previous combined plan is likely flawed. We have already observed that even when the runner's logs indicate its cache is cleared, a subsequent request immediately fails with the same stale module error. This suggests the "clearing" is not effective in preventing the issue, or there is a timing issue we do not yet understand.

**Revised Plan:**
- Instead of re-implementing a potentially flawed solution, the next step is to gather more precise diagnostic evidence to prove the race condition hypothesis.
- We will add more granular logging to establish a definitive timeline of events:
    1.  **HMR Sent:** Logged in `ssrBridgePlugin.mts` when the `full-reload` is forwarded.
    2.  **Cache Cleared:** Logged in `dist/runner-worker/index.js` inside the `full-reload` handler.
    3.  **Re-import Attempted:** A new log will be added to `dist/runner-worker/index.js` immediately before the `runner.import()` loop.
    4.  **Failure Captured:** Logged by the middleware in `dependencyOptimizationOrchestrationPlugin.mts` when the "stale pre-bundle" error is caught.
- Analyzing the sequence of these logs in the console will confirm the exact timing and prove whether the runner's re-import attempt is happening before the Vite server is ready.

**Findings:**
- The validation test confirmed the race condition. Disabling the runner's re-import loop in `node_modules` prevented the "stale pre-bundle" error.
- However, simply re-enabling the middleware with a 307 redirect still resulted in an infinite loop, proving that the solution is not that simple. The redirect itself re-triggers the error before the server can stabilize.

**Revised Conclusion:**
- We cannot fix the race condition at the runner level without patching `node_modules`.
- We must handle the error at a higher level, but a simple redirect is not sufficient as it re-triggers the race condition.
- The correct approach must be to use the error as a signal to perform a comprehensive, system-wide reset that includes the server *and* the client, ensuring the next request starts from a truly clean slate.

### Attempt #16: System-Wide Reset from Middleware

**Plan:**
- The middleware in `dependencyOptimizationOrchestrationPlugin.mts` will be our primary control point.
- When it catches the "stale pre-bundle" error, it will perform the following actions:
  1.  **Invalidate Server Caches:** Call `server.moduleGraph.invalidateAll()` on both the `worker` and `ssr` environments.
  2.  **Trigger Runner Cache Clear:** Broadcast a `full-reload` HMR message directly to the worker's HMR channel via `server.environments.worker.hot.send()`.
  3.  **End the Doomed Request:** Respond with a `205 Reset Content` status to tell the browser the request is finished, allowing the HMR reload to take over.

**Findings:**
- The test was run with two variations:
    1.  **With the runner's re-import loop enabled:** The middleware caught the `ssr_bridge` error as expected, but the `205` response caused the client-side infrastructure to break, resulting in a blank page. The connection was unexpectedly closed.
    2.  **With the runner's re-import loop disabled (via patch):** The `ssr_bridge` error disappeared, confirming the race condition theory. However, the client-side still broke with a blank page due to the `205` response.
- **Conclusion:** Our race condition theory is correct, but our solution of responding with a `205` is too disruptive. The client's streaming infrastructure cannot handle the unexpected termination of the request.

### Attempt #17: Suspending the Request

**Hypothesis:** Instead of terminating the failing request, we should "suspend" it and let an out-of-band HMR message trigger the client-side refresh.

**Plan:**
- The middleware in `dependencyOptimizationOrchestrationPlugin.mts` will be modified.
- When it catches the "stale pre-bundle" error, it will:
  1.  Perform the same reset actions: invalidate all server module graphs and send the `full-reload` message to the worker's HMR channel.
  2.  **Crucially, it will not respond to the request.** It will neither call `next()` nor `res.end()`. This will leave the HTTP request pending.
- The theory is that the `full-reload` HMR message will reach the client and trigger a full page refresh, which will initiate a new, clean request. The original, suspended request will eventually time out and be discarded, but by then, the new navigation will have taken over.

**Rejection of the "Suspend" Plan:**
- I think there are two critical flaws with this plan:
  1.  **Past Failures:** We have tried variations of suspending the request before, and it has consistently resulted in an infinite reload loop centered on the `rwsdk___ssr_bridge` module. The plan does not adequately explain why this attempt would be different.
  2.  **No-JS Edge Case:** The plan relies on a client-side HMR client to receive the `full-reload` signal and refresh the page. This would fail completely for pages that do not have client-side JavaScript, a valid use case for this framework.
- For these reasons, this plan is considered invalid and will not be pursued.

### A Deeper Synthesis: The In-Flight Promise Cache

**Synthesized Finding:**
- A comprehensive review of the entire work log, prompted by some skepticism of mine, reveals a persistent pattern: even after the `CustomModuleRunner`'s `evaluatedModules` cache is cleared, a subsequent request immediately fails with the same stale module error. This implies a second, persistent caching layer.
- The `ModuleRunner` implementation in Vite Core (and used by `vite-plugin-cloudflare`) contains a second cache: `concurrentModuleNodePromises`. This is a `Map` that stores in-flight promises for module requests to prevent redundant fetching.
- The `full-reload` HMR handler, which calls `clearCache()`, only clears the `evaluatedModules` cache. It does **not** clear `concurrentModuleNodePromises`.

**New Hypothesis:**
- The infinite loop is caused by this second cache.
  1. A request begins, and the runner creates a pending promise for a module (e.g., `ssr_bridge`), storing it in `concurrentModuleNodePromises`.
  2. This fetch triggers a re-optimization, making the pending promise stale.
  3. A `full-reload` event clears `evaluatedModules`, but the stale promise remains in `concurrentModuleNodePromises`.
  4. A new request (from a redirect or reload) arrives and asks for the same module.
  5. The runner finds the still-pending stale promise in `concurrentModuleNodePromises` and re-uses it.
  6. The stale promise eventually resolves with an old version hash, causing the "stale pre-bundle" error and restarting the loop.

**Revised Diagnostic Plan:**
- To prove this hypothesis, we will add a diagnostic log to the `cachedModule` method in the patched `dist/runner-worker/index.js`.
- This log will indicate whether a cached promise is being re-used from `concurrentModuleNodePromises`. If we see this log fire on the second request in the loop, it will confirm this theory is correct.

**Findings:**
- The diagnostic logs were successfully added to the correct location in `getFetchedModuleId`.
- The logs show `[RWS-DIAGNOSTIC] In-flight promise cache miss for: ...` for all relevant modules, including `/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge`. There are no "cache hit" logs during the failure loop.
- **Conclusion:** The hypothesis is incorrect. The in-flight promise cache is not the cause of the loop. The logs prove that the runner's caches are effectively cleared, and it is attempting to fetch fresh modules.

### Attempt #20: Tracing the Stale Hash on the Vite Server

**Synthesized Finding:**
- The Cloudflare runner is doing the right thing: its caches are clear, and it requests a clean virtual ID (`virtual:rwsdk:ssr:rwsdk/__ssr_bridge`).
- The "stale pre-bundle" error is still thrown. This means the stale version hash (`?v=OLD_HASH`) must be introduced on the Vite server side when it receives the request to resolve and load this virtual module.

**New Hypothesis:**
- The `moduleGraph.invalidateAll()` call is insufficient. While it clears the cache of *transformed module code*, it does not clear or update the dependency optimizer's internal state, specifically its `_metadata`.
- This `_metadata` object contains the `browserHash` and resolved paths for all pre-bundled dependencies. We hypothesize that after a re-optimization, this metadata becomes stale in the `ssr` environment.
- When our `ssrBridgePlugin`'s `load` hook calls `devServer.environments.ssr.fetchModule()`, Vite's internal resolution consults this stale metadata, resolves the clean ID to a URL with an old, invalid version hash, and then throws the "stale pre-bundle" error when it tries to access it.

**Revised Diagnostic Plan:**
- Add logging to the `load` hook of `sdk/src/vite/ssrBridgePlugin.mts`.
- We need to log the following information just before the `devServer.environments.ssr.fetchModule()` call for our virtual SSR modules:
  1. The `id` received by the `load` hook.
  2. The value of `server.environments.ssr.depsOptimizer._metadata.browserHash`.
  3. We will wrap the `fetchModule` call in a `try...catch` block to log the specific error and confirm this is the point of failure.
- This will give us direct evidence of the state of the SSR dependency optimizer at the moment of failure.

### Attempt #22: Proving Stale Transform Caching

**Hypothesis:** The root cause is a stale transformed module being served from the Vite `worker` environment's module graph cache.

The sequence of events is as follows:
1. Before any error, a module in the `worker` environment that imports `rwsdk/__ssr_bridge` is loaded and transformed by Vite's internal `loadAndTransform` function. During this transformation, the import is resolved to a concrete, optimized path including the current version hash (e.g., `.../deps_ssr/rwsdk___ssr_bridge.js?v=OLD_HASH`). This transformed code is then cached in the worker's module graph.
2. An SSR re-optimization occurs, creating a `NEW_HASH` for all SSR dependencies.
3. The `full-reload` HMR event successfully clears the execution cache in the Cloudflare runner, but it does **not** invalidate the stale transformed code for the importer module in Vite's `worker` module graph.
4. The runner re-requests its entrypoint. When it gets to the importer module, Vite's dev server finds the cached (and now stale) transformation and serves it, bypassing the `loadAndTransform` function.
5. The runner executes this stale code, which contains the import for `...rwsdk___ssr_bridge.js?v=OLD_HASH`, triggering the "stale pre-bundle" error.

**Diagnostic Plan:**
To get definitive proof, we will add a diagnostic log directly inside Vite's compiled `loadAndTransform` function. This will allow us to inspect the final transformed code of any module that imports the `ssr_bridge` *before* it is cached.

1.  **Target File:** The compiled Vite chunk, located at `node_modules/.pnpm/vite@.../node_modules/vite/dist/node/chunks/dep-....js`.
2.  **Target Function:** The `loadAndTransform` function within that file.
3.  **Action:** Add a conditional `console.log` at the end of the function, just before it returns the `result`. The log will fire if the environment is `worker` and the transformed code includes `"rwsdk/__ssr_bridge"`. It will print the module `id` and the `result.code`.

This will show us, in black and white, the exact code being generated and cached. If our hypothesis is correct, we will see the `OLD_HASH` in the log output for the initial load, and crucially, we will *not* see this log fire again for that module after the re-optimization, proving that Vite is serving a stale entry from its cache.

### Attempt #23: Correcting the Analysis - Stale Resolution, Not Stale Transform

**Correction of Previous Analysis:**
My previous conclusion in Attempt #22 was incorrect. I had mistakenly claimed that Vite was serving a stale transform from its cache. After reviewing the logs again, I see this is false.

**The True Finding:**
The diagnostic log inside `loadAndTransform` for `ClientComponent.tsx` shows the following transformed code:

```javascript
const __vite_ssr_import_0__ = await __vite_ssr_import__("/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge", {"importedNames":["ssrLoadModule"]});
```

This is the critical piece of evidence. The transformed code does **not** contain a baked-in version hash. It correctly references the clean, virtual module ID. This proves that the `worker` environment's transform cache is **not** the source of the stale hash.

**New Hypothesis:**
The stale version hash is being introduced at a later stage, during the **resolution** of this clean virtual ID. When the runner executes this code, it requests `/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge`. Our `ssrBridgePlugin`'s `load` hook then calls `server.environments.ssr.fetchModule('rwsdk/__ssr_bridge', ...)`. The error happens inside this `fetchModule` call.

This strongly suggests that the `ssr` environment's internal dependency resolver is using stale metadata. Even after re-optimization creates a new hash, some part of the SSR environment that my plugin is interacting with retains the old information and incorrectly resolves `rwsdk/__ssr_bridge` to a path with the old, invalid version hash. The money is at finding where Vite decides what hash to use for this resolution.

**Next Diagnostic Plan:**
I need to trace where the clean ID `rwsdk/__ssr_bridge` gets resolved into the stale path `.../deps_ssr/rwsdk___ssr_bridge.js?v=OLD_HASH`. This resolution happens inside the `ssr` dependency optimizer. My next step is to inspect the state of this optimizer's metadata right before the failure.

### Attempt #24: The Final Diagnosis - A Stale Resolver, Not Stale Metadata

**Definitive Finding:**
Capturing the `metadata` object on error has revealed the final piece of the puzzle. The logs show a critical contradiction:

1.  **The Error:** The server throws an `ERR_OUTDATED_OPTIMIZED_DEP` error because a module was requested with the old hash (e.g., `v=7c4427a7`).
2.  **The Metadata:** The `metadata` object logged from `ssrOptimizer.metadata` at the exact moment of the crash contains the **new, correct hash** (e.g., `browserHash: "9e5f9789"`). The file path for `rwsdk/__ssr_bridge` inside this metadata object correctly points to the URL with the new hash.

**Conclusion:**
The `depsOptimizer` instance our `ssrBridgePlugin` has access to is **not stale**. Its `.metadata` property is fully up-to-date after the re-optimization.

The root cause must be a subtle race condition deep inside Vite's `fetchModule` implementation. When we call `fetchModule`, some part of its internal module resolution pipeline is consulting an older, stale state to resolve the clean module ID (`rwsdk/__ssr_bridge`) into a file path. This internal resolver is using the old hash. This stale path is then passed to the final check, which compares it against the new metadata and correctly throws the error.

The problem is not a stale object reference in our code, but perhaps a state inconsistency within Vite's internal resolution process.

### Attempt #25: Tracing Vite's Internal Resolution

**Hypothesis:**
The state inconsistency lies within Vite's internal plugin pipeline during module resolution. Specifically, when `fetchModule` is called, a plugin with a stale internal state resolves `rwsdk/__ssr_bridge` to a path with an old version hash *before* the `vite:optimized-deps` plugin's `load` hook gets to validate it.

**Investigation Plan:**
My goal is to trace the resolution of a bare import specifier to its final, versioned, optimized dependency URL. I'll do this by inspecting Vite's internal plugins.

1.  **Find the Error:** I started by `grep`ing for `ERR_OUTDATED_OPTIMIZED_DEP`. This confirmed the error is thrown from `packages/vite/src/node/plugins/optimizedDeps.ts` in its `load` hook. This hook checks if the `?v=` hash in the requested URL matches the hash in the optimizer's current metadata. This proves the `load` hook is receiving an already-stale URL.

2.  **Find the Resolver:** I then searched for `resolveId` hooks in Vite's plugins to find what runs *before* the `load` hook. Two plugins stood out: `vite:optimized-deps` and `vite:pre-alias`. The `pre-alias` plugin's job is to handle aliased dependencies, which is exactly what an optimized dependency is.

3.  **Trace `pre-alias`:** Reading `preAlias.ts` showed that for aliased bare imports, it calls `tryOptimizedResolve`.

4.  **Trace `tryOptimizedResolve`:** Reading `resolve.ts`, I found `tryOptimizedResolve`. This function is the key. It takes the deps optimizer, gets its `metadata`, and then calls `optimizedDepInfoFromId(metadata, id)` to get the information for the dependency.

5.  **Trace `optimizedDepInfoFromId`:** This function, in `optimizer/index.ts`, simply does a lookup in the `metadata.optimized` and `metadata.discovered` objects.

**The Inescapable Conclusion:**
This trace confirms a perplexing situation. The logic flow is as follows: `pre-alias` -> `tryOptimizedResolve` -> `optimizedDepInfoFromId`. Each step in this chain appears to be stateless, simply passing along the `depsOptimizer` instance and its `metadata` object. We have already proven via logging that the `metadata` object holds the *correct, new* hash at the time of failure.

This leaves only one logical possibility, however unlikely: some part of Vite's system is holding on to a stale reference to the entire `depsOptimizer` object, and passing that stale object into the `resolveId` pipeline. While our plugin's `load` hook sees the fresh optimizer, the `pre-alias` plugin is somehow operating on an old one.

This points to a deep, internal state management issue within Vite when environments are used. Given the difficulty of fixing this internally, the most robust solution is to fall back to the one that addresses the state inconsistency at a higher level: forcing the worker's caches to clear when the SSR environment re-optimizes.

### Attempt #26: Pinpointing the Stale Resolution in Vite Core

**Hypothesis:**
My analysis in Attempt #25 concluded that a stale `depsOptimizer` object is being passed into Vite's internal resolution pipeline (`vite:pre-alias` plugin), causing it to resolve module IDs using stale metadata. The goal of this attempt is to get direct, logged proof of this happening.

**Diagnostic Plan:**
I will add a diagnostic log inside Vite's `tryOptimizedResolve` function. This is the exact function where a bare import is converted into a full, versioned path to an optimized dependency.

The log will capture the following information at the moment of resolution:
1.  The `id` being resolved (e.g., `rwsdk/__ssr_bridge`).
2.  The `browserHash` from the `depsOptimizer.metadata` object that the function has access to.
3.  The specific `browserHash` attached to the `depInfo` object retrieved for that `id`.
4.  The final, resolved URL that the function is about to return.

If the hypothesis is correct, the log will show that when the error occurs, `tryOptimizedResolve` is operating with a `metadata` object containing the **old `browserHash`**, and is therefore generating a stale URL. This would be the definitive proof we need.

**Findings: CONFIRMED**
The diagnostic logs provided the definitive proof. After a re-optimization was triggered, the `[VITE-RESOLVE-DIAGNOSTIC]` log fired again for `rwsdk/__ssr_bridge`. It clearly showed that the `tryOptimizedResolve` function was still working with the old `metadata` object, logging the old `browserHash` (e.g., `7c4427a7`).

This confirms that Vite's internal `resolveId` pipeline is being fed a stale `depsOptimizer` instance. While other parts of Vite have access to the new, post-optimization state, the resolver does not. This is the root cause of the stale URL generation.

### Attempt #27: The Combined Solution - FAILED

**Hypothesis:**
Based on the definitive finding of a stale resolver, the solution must be a two-part approach that handles both state synchronization and the resulting race condition.

1.  **State Synchronization:** The `ssrBridgePlugin` must intercept the `full-reload` HMR event from the SSR environment and propagate it to the worker environment. This acts as the official signal for the worker's caches (`moduleGraph`, runner's `evaluatedModules`) and internal state (like the resolver's `depsOptimizer` reference) to begin updating. This is the key to preventing an infinite loop.

2.  **Race Condition Handling:** The `dependencyOptimizationOrchestrationPlugin` must use an error-handling middleware to catch the one, predictable "stale pre-bundle" error that will occur when the Cloudflare runner immediately re-imports its modules before the Vite server has finished its internal state synchronization. By responding with a `307 Temporary Redirect`, the middleware provides the small delay of an HTTP round-trip, giving the server the time it needs to stabilize. The re-issued request from the runner will then hit a fully consistent server.

**Implementation:**
- The `configureServer` hook in `ssrBridgePlugin.mts` will be modified to monkey-patch `server.environments.ssr.hot.send`, detect `full-reload` events, and then invalidate the worker module graph and forward the HMR event.
- The error-handling middleware in `dependencyOptimizationOrchestrationPlugin.mts` will be modified to respond with a `307` redirect when it catches the "stale pre-bundle" error.

**Findings:**
The test resulted in an infinite redirect loop. This proves that the combined actions of invalidating caches and propagating the HMR event are still not sufficient to bring the Vite server into a consistent state before the redirected request arrives. The stale resolver is more persistent than anticipated.

### Attempt #28: A Surgical Approach via `resolveId`

**Hypothesis:**
My previous attempts at high-level resets have failed because they don't address the stale resolution at the precise moment it happens. The `resolveId` hook in our `ssrBridgePlugin` is a powerful, surgical interception point that we have not fully leveraged. The existing hash-stripping code in that hook is not being reached, but it gives me an idea.

Instead of reacting to an error that has already happened, I can use the `resolveId` hook to proactively inspect every resolution attempt related to the `ssr_bridge` and either correct it or pause it.

**Diagnostic Plan:**
The first step is to gather more data. I will add comprehensive logging to the `resolveId` hook in `ssrBridgePlugin.mts` to trace every time a module related to `ssr_bridge` is resolved.

The log will capture:
1.  The `source` being resolved.
2.  The `importer` that is requesting it.
3.  The Vite `environment` (`this.environment.name`) where the resolution is occurring.

This will give me a complete picture of the resolution lifecycle. Based on these logs, I can determine the best course of action:

- If I find a resolution attempt where a stale hash is present, I can implement a more effective hash-stripping logic.
- If, as I suspect, the resolution is happening with a clean ID but still failing later, this `resolveId` hook might be the perfect place to implement a "defer" or "wait" mechanism, pausing the resolution until I can be sure the dependency optimizer is in a stable state.

**Findings:**
The diagnostic logs confirmed the hypothesis. The `resolveId` hook is indeed called for `rwsdk/__ssr_bridge`, but the `source` string it receives is always clean, without a version hash. This proves that the stale hash is being applied later in Vite's internal resolution pipeline. The existing hash-stripping logic is therefore ineffective.

### Attempt #29: The Proactive Deferral Plan

**Hypothesis:**
Since the `resolveId` hook provides a reliable, surgical interception point before the stale resolution occurs, I can use it to proactively prevent the race condition. Instead of reacting to an error, I will defer the resolution of the critical `rwsdk/__ssr_bridge` module until I can be certain that no dependency optimizations are in-flight.

**The Plan:**
This plan combines two mechanisms from previous attempts into a new, proactive strategy.

1.  **Track In-Flight Optimizations (`dependencyOptimizationOrchestrationPlugin`):** I will re-implement the logic to track when any of Vite's three dependency optimizers (`ssr`, `worker`, `client`) are running.
    -   In the `configureServer` hook, I will monkey-patch the `registerMissingImport` method on each optimizer.
    -   The wrapper will add a promise to a shared, exported `Set` (`activeOptimizationPromises`) when an optimization starts, and remove it when it settles.

2.  **Defer Resolution (`ssrBridgePlugin`):** I will modify the `resolveId` hook to use this shared state.
    -   It will import the `activeOptimizationPromises` `Set`.
    -   When the hook is called for a `source` that includes `rwsdk/__ssr_bridge`, it will first check if the `Set` is empty.
    -   If the `Set` is not empty, it will `await Promise.all([...activeOptimizationPromises])`. This will pause the resolution until all ongoing optimizations are complete.
    -   Once the server is stable, the resolution will proceed as normal.

This approach should prevent the stale resolver from ever being consulted during its inconsistent state, thereby eliminating the root cause of the error.

### Attempt #30: The Timing-Based Deferral (Validation)

**Correction:**
The "Proactive Deferral" plan in Attempt #29, while logical, is a path I have explored extensively in the past with disastrous results. Trying to precisely track Vite's optimization state is a fragile endeavor that has led to multiple failed releases. It is not a viable strategy. I am abandoning this approach.

**New Hypothesis:**
The core problem is a race condition where the resolver's state is inconsistent for a brief period after re-optimization. A simple, fixed delay might be sufficient to wait out this period of instability.

**Validation Plan:**
To test this hypothesis in the simplest way possible, I will implement a "blunt" timing-based solution.
1.  **Remove Complex Logic:** I will revert the changes from Attempt #29, removing the optimization promise tracking from `dependencyOptimizationOrchestrationPlugin` and `ssrBridgePlugin`.
2.  **Implement Simple Delay:** In the `resolveId` hook of `ssrBridgePlugin`, when the `ssr_bridge` is being resolved, I will introduce a short, fixed-delay `setTimeout` (e.g., 250ms). This will pause the resolution.
3.  **Disable Middleware:** I will also disable the error-handling middleware in `dependencyOptimizationOrchestrationPlugin` for this test. If the simple delay works, the "stale pre-bundle" error should never be thrown, and the middleware will not be needed.

This is not a production-ready solution, but it will serve as a definitive test. If this simple delay prevents the error, it proves that "waiting" is the correct strategy, and we can then focus on finding a more elegant way to implement that wait.

**Findings:**
The timing-based deferral in `resolveId` did not work. The error still occurred.

### Attempt #31: Timing-Based Deferral in `load` Hook

**Hypothesis:**
My previous attempt to defer in the `resolveId` hook was too early in Vite's pipeline. The critical moment of failure is when our `load` hook calls `fetchModule`. By moving the delay to this later stage, we can pause the request at a point that is much closer to the actual failure, which may give the server the time it needs to stabilize.

**Validation Plan:**
I will test this new hypothesis by moving the simple, timing-based delay.
1.  **Remove Delay from `resolveId`:** I have already removed the `setTimeout` logic from the `resolveId` hook in `ssrBridgePlugin`.
2.  **Add Delay to `load`:** I will add a similar `setTimeout` delay (e.g., 250ms) to the `load` hook in `ssrBridgePlugin`, specifically just before the `server.environments.ssr.fetchModule()` call is made for the `ssr_bridge`.

This test will tell us if the *location* of the delay is the critical factor.

**Findings:**
The timing-based deferral in the `load` hook also failed. Even with a 2-second delay before every `fetchModule` call, the "stale pre-bundle" error still occurred, though for a different module (`react/jsx-dev-runtime`). This proves that a simple, proactive delay—regardless of its location—is not a viable solution. The server's inconsistent state can persist longer than any reasonable fixed timeout.

### Attempt #32: Reactive Deferral in Middleware

**Hypothesis:**
My previous attempts at proactive deferral failed. A reactive approach is needed, but it must be more robust. The last time we tried an error-handling middleware, it caused an infinite redirect loop because the server state was never corrected. Now that we have a better understanding of the need to reset state, we can try again with a crucial addition: a delay *after* the reset.

**Validation Plan:**
This plan combines the error-handling middleware with a timing-based delay, placing the delay in the reactive phase where it can be most effective.
1.  **Re-enable Middleware:** I will re-enable the error-handling middleware in `dependencyOptimizationOrchestrationPlugin.mts`.
2.  **Implement Reset and Delay:** When the "stale pre-bundle" error is caught, the middleware will:
    a. Perform a "hard reset" by invalidating the `worker` and `ssr` module graphs.
    b. **Crucially, `await` a 2-second timeout.** This pauses the error handler, giving the server a moment to stabilize *after* the reset has been triggered.
    c. After the delay, issue a `307 Temporary Redirect` to have the client re-attempt the request.

By waiting *after* the reset, we ensure that by the time the redirect is issued and the new request arrives, the server has had ample time to get its internal state in order.

**Findings:**
The "reset, wait, redirect" middleware strategy has failed. The error still occurs, leading to an infinite redirect loop. This is a critical finding: even after a hard reset of the module graphs and a 2-second delay, a stale reference persists somewhere in Vite's internal state, causing the redirected request to fail in the exact same way. This proves that a simple timed delay is insufficient because the problem is not a transient race condition, but a persistent stale reference.

### Attempt #33: Validating Stale Reference Theory with Monkey-Patch

**Hypothesis:**
A stale reference to the `depsOptimizer` object is being used deep inside Vite's resolver pipeline (`vite:pre-alias` plugin). Because this is a stale *object reference*, no amount of cache invalidation or waiting will fix it. The only way to solve the problem is to ensure the resolver uses the most up-to-date instance of the optimizer.

**Validation Plan:**
To validate this, I will perform a two-part monkey-patch to surgically inject the fresh `depsOptimizer` instance at the point of failure.
1.  **Part 1 (Our Code):** In the `ssrBridgePlugin`'s `load` hook, immediately before calling `fetchModule`, I will store the guaranteed-fresh `depsOptimizer` from `server.environments.ssr.depsOptimizer` on a temporary global variable (`globalThis.__RWS_FRESH_DEPS_OPTIMIZER__`).
2.  **Part 2 (Vite Code):** I will patch the compiled `tryOptimizedResolve` function in Vite's `node_modules`. The patch will make the function check for the existence of `globalThis.__RWS_FRESH_DEPS_OPTIMIZER__` and use it in place of the stale `depsOptimizer` argument it receives.

If this two-part patch prevents the error, it will be definitive proof that the stale `depsOptimizer` reference is the one and only root cause. We can then devise a non-patch solution based on this knowledge.

### Attempt #34: Full Validation with Widened Monkey-Patch

**Hypothesis:**
The previous monkey-patch failed because its scope was too narrow. By removing the `finally` block that cleans up the global override, the fresh `depsOptimizer` will remain in place for the entire duration of the request, covering not just the initial resolution of the bridge module but all of its subsequent, nested dependencies. This should result in a completely successful run and fully validate the root cause.

**Plan:**
1.  Modify `ssrBridgePlugin.mts` to remove the `finally` block that deletes `globalThis.__RWS_FRESH_DEPS_OPTIMIZER__`.
2.  Run the test again and confirm that no "stale pre-bundle" error occurs.

### Attempt #35: Conditional Monkey-Patch to Isolate SSR Resolutions

**Hypothesis:**
A monkey-patch that *conditionally* swaps the `depsOptimizer` only for SSR resolutions will fix the "stale pre-bundle" error without introducing the "react-server" condition error. The condition for detection is `depsOptimizer.options.conditions.includes('browser') && !depsOptimizer.options.conditions.includes('react-server')`.

**Findings: FAILED**
The conditional patch did not solve the problem. The diagnostic logs revealed a critical new insight: `tryOptimizedResolve` (and thus our patch) is only executed *once* for a given module, early in the process. After the HMR event that triggers the re-optimization and the subsequent failure, the logs from our patch do *not* appear again.

This strongly suggests that a higher-level cache is at play. Vite appears to be caching the *resolved ID* (including the now-stale version hash) and is not re-running the full resolution logic for the module on subsequent requests, even after module graph invalidation. This upstream cache is preventing our patch from ever running on the problematic, post-reload request. Our investigation must now focus on identifying and invalidating this higher-level cache.

With the root cause fully understood, the diagnostic phase is complete. We can now remove the monkey-patches and devise a robust, self-contained solution within our own plugins. The goal is to ensure that a fresh reference to the correct (`worker`) `depsOptimizer` is used for any resolution that happens after a re-optimization event.

**Next Steps: Find the Cache**
The diagnostic phase is not complete. The immediate next step is to investigate Vite's source code to locate the suspected higher-level cache that stores resolved module IDs. We must understand how this cache is populated, when it is used, and what mechanism exists (if any) to invalidate it. Only then can we devise a proper solution.

**Findings (continued): The Two Caches**
Further investigation into Vite's source code has pinpointed the exact caching mechanism and revealed a two-layer problem.

1.  **The `metadata` Cache:** We traced the source of the stale `browserHash` to the `optimizedDepInfoFromId` function (`packages/vite/src/node/optimizer/index.ts`). This function is not a complex mechanism; it's a simple property lookup on the `metadata` object passed into it. It checks `metadata.optimized[id]`, `metadata.discovered[id]`, and `metadata.chunks[id]`, returning the first match. This confirms that a stale `metadata` object is being passed down the resolution pipeline, and this object is the direct source of the stale `depInfo`.

2.  **The Resolved ID Cache:** The fact that our monkey-patch in `tryOptimizedResolve` only ever runs *once* per module proves the existence of a higher-level cache. This cache stores the *result* of the initial, successful resolution (e.g., `/path/to/dep.js?v=OLD_HASH`). On subsequent requests after the HMR reload, Vite is hitting this higher-level cache and serving the stale, versioned path directly, without ever re-running the `tryOptimizedResolve` logic.

Our `moduleGraph.invalidateAll()` calls are clearly insufficient as they do not clear either of these caches. The problem is now twofold: we must find a way to invalidate the higher-level resolved ID cache to force re-resolution, and we must ensure that when re-resolution occurs, it uses a fresh `metadata` object.

**Next Steps: Find the Higher-Level Cache**
The investigation continues. The immediate next step is to find where this higher-level resolved ID cache is located in Vite's source code and determine how to invalidate it.

### Attempt #37: Tracing the Full Execution Path

**Goal:** To document the entire chain of events from our plugin's `fetchModule` call to the final "stale pre-bundle" error, identifying all key functions, caches, and decision points. This will serve as the definitive map for our diagnostic logging.

---

#### The Execution Trace

This is the step-by-step journey of a module request that leads to the stale pre-bundle error.

**Phase 1: The `ssrBridgePlugin` Initiates the Request**

1.  **Origin Call**
    *   **File:** `sdk/src/vite/ssrBridgePlugin.mts` (our code)
    *   **Function:** `load` hook
    *   **Action:** Our plugin calls `devServer.environments.ssr.fetchModule(idForFetch)`. This is the entry point into Vite's internal machinery for the SSR environment.
    *   **What follows:** `fetchModule` is an API on the `DevEnvironment` object. Its job is to orchestrate the loading, transformation, and execution of a module within its environment.

2.  **`fetchModule` and `transformRequest`**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/server/environment.ts`
    *   **Function:** `fetchModule`
    *   **Action:** `fetchModule` quickly calls `transformRequest(url, this)`. `transformRequest` is the heart of Vite's dev server, responsible for running a module's URL through the entire plugin pipeline.

**Phase 2: Vite's Resolution Pipeline and the Hidden Cache**

3.  **The Plugin Container and `resolveId`**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/server/transformRequest.ts`
    *   **Function:** `transformRequest`
    *   **Action:** `transformRequest` first needs to resolve the module ID. It calls `pluginContainer.resolveId(url, importer, ...)`. This kicks off the chain of `resolveId` hooks from all registered plugins.

4.  **The Higher-Level Cache (`packageCache`)**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/node/plugins/resolve.ts`
    *   **Function:** `tryNodeResolve` -> `resolvePackageEntry`
    *   **Action:** The `vite:resolve` plugin's `resolveId` hook runs. For a bare import like `rwsdk/__ssr_bridge`, it calls `tryNodeResolve`. This function eventually calls `resolvePackageEntry`. At the very top of `resolvePackageEntry`, it checks a cache:
        ```typescript
        const cached = getResolvedCache('.', options)
        if (cached) {
          return cached + postfix
        }
        ```
    *   **This is the higher-level cache.** It stores the *result* of a previous successful resolution. If it gets a hit here, it returns the stale, fully-resolved path (e.g., `/path/to/dep.js?v=OLD_HASH`) and the `resolveId` chain stops. This is why our logs in `tryOptimizedResolve` were not firing on the second request.
    *   **Proposed Log:** We need to patch the `getResolvedCache` method in `packages/vite/src/node/packages.ts` to log hits and misses.
        ```javascript
        // In loadPackageData() -> getResolvedCache()
        const cacheKey = getResolveCacheKey(key, options);
        const hit = resolvedCache[cacheKey];
        if (id.includes('__ssr_bridge')) {
            if (hit) {
                console.log(`[RWS-VITE-LOG-1] packageCache HIT for ${id}. Returning stale path: ${hit}`);
            } else {
                console.log(`[RWS-VITE-LOG-1] packageCache MISS for ${id}.`);
            }
        }
        return hit;
        ```

**Phase 3: Hash Generation (on Cache Miss)**

5.  **`tryOptimizedResolve`**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/node/plugins/resolve.ts`
    *   **Function:** `tryOptimizedResolve`
    *   **Action:** If the `packageCache` misses, the resolution proceeds. The `vite:pre-alias` plugin (which runs before `vite:resolve`) calls `tryOptimizedResolve` for bare imports.

6.  **The Smoking Gun: `getOptimizedDepId`**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/node/optimizer/optimizer.ts`
    *   **Function:** `getOptimizedDepId`
    *   **Action:** `tryOptimizedResolve` retrieves the `depInfo` from the optimizer's `metadata` and calls `depsOptimizer.getOptimizedDepId(depInfo)`. This function constructs the final versioned URL: `` `${depInfo.file}?v=${depInfo.browserHash}` ``.
    *   **Proposed Log:** We will re-add our log to `tryOptimizedResolve` to see the state of the metadata it's using.
        ```javascript
        // In tryOptimizedResolve()
        const metadata = depsOptimizer.metadata;
        const depInfo = optimizedDepInfoFromId(metadata, id);
        if (id.includes('__ssr_bridge')) {
            console.log(`[RWS-VITE-LOG-2] tryOptimizedResolve for ${id}. Metadata hash: ${metadata.browserHash}. Dep hash: ${depInfo?.browserHash}`);
        }
        ```

**Phase 4: Execution via the Module Runner**

7.  **Vite to Runner Handoff**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/server/environment.ts`
    *   **Function:** `fetchModule`
    *   **Action:** After `transformRequest` successfully returns the transformed code, `fetchModule`'s final step is to execute it. It calls `runner.import(url)`, where `runner` is the `CustomModuleRunner` provided by `vite-plugin-cloudflare`.

8.  **Inside the Runner**
    *   **File:** `vite-plugin-cloudflare`'s `runner-worker/index.js` (compiled)
    *   **Functions:** `cachedRequest` -> `directRequest` -> `runInlinedModule`
    *   **Action:** The runner's `import` method starts a chain of internal calls. It attempts to load the module's dependencies. One of these dependencies will be the stale URL (e.g., `react?v=OLD_HASH` or the bridge itself if it's the source of the error). This triggers an HTTP request from the runner back to the Vite dev server.
    *   **Proposed Log:** We can log the URL being requested by the runner.
        ```javascript
        // In the runner's `request` or `cachedModule` function
        if (url.includes('__ssr_bridge')) {
            console.log(`[RWS-VITE-LOG-3] Runner is requesting stale URL: ${url}`);
        }
        ```

**Phase 5: The Error**

9.  **Vite Catches the Stale Request**
    *   **File:** `/Users/justin/rw/clones/vite/packages/vite/src/node/plugins/optimizedDeps.ts`
    *   **Function:** `load` hook
    *   **Action:** The Vite dev server receives the runner's request for the stale URL. The `vite:optimized-deps` plugin's `load` hook intercepts it. It checks the `v` query parameter against the *current* (new) `browserHash` in its metadata. They don't match.
    *   It throws the `ERR_OUTDATED_OPTIMIZED_DEP` error, which is the "stale pre-bundle" message. This error travels back to the runner, which then logs it to the console, producing the stack trace we see.

### Attempt #38: The Definitive Diagnosis - Stale Transform Cache

**Hypothesis:** The root cause is Vite's `moduleGraph` serving a stale transform of `rwsdk_worker.js` that contains a baked-in stale URL for `ssr_bridge`. This happens because `moduleGraph.invalidateAll()` isn't working as expected.

**Plan:** Add diagnostic logs directly into the compiled `doTransform` function in Vite's dist output to definitively prove whether a cached result is being served after a `full-reload`.

**Findings:** The logs from this attempt were definitive, but showed the opposite of the hypothesis.

-   `[RWS-VITE-PROOF-1] Using cached transform for: ...` logged during normal HMR, as expected.
-   `[RWS-VITE-PROOF-2] No fresh cache. Re-transforming: ...` logged immediately after the `full-reload` event.

**Conclusion:** This **disproves the stale transform cache theory**. The `moduleGraph` invalidation is working correctly, and `rwsdk_worker.js` is being re-transformed every time. The problem lies elsewhere.

### Attempt #39: Analyzing the Transformed Code

**Hypothesis:** Following the disproval of the stale transform theory, the focus returns to the runtime resolution of the `ssr_bridge` import. The staleness is not in the transformed code of the importer (`rwsdk_worker.js`), but is introduced when `__vite_ssr_import__` is called at runtime.

**Plan:** Log the contents of the freshly transformed `rwsdk_worker.js` to inspect the import specifier for `ssr_bridge`.

**Findings:** The transformed code for `rwsdk_worker.js` contains the following import call:

```javascript
const __vite_ssr_import_14__ = await __vite_ssr_import__("/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge", {"importedNames":["createThenableFromReadableStream","renderHtmlStream"]});
```

**Conclusion:** This is the definitive proof. The import specifier `/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge` has **no version hash**. The transformed code is clean. The stale hash is being applied later, during the runtime resolution initiated by the `__vite_ssr_import__` call.

This shifts the investigation's focus squarely onto our `ssrBridgePlugin.mts` and its `load` hook, which is responsible for handling these virtual IDs. The question now is what happens inside that hook during the race condition. The use of a dynamic `import()` to replace `__vite_ssr_import__` is a potential source of timing differences that could contribute to the issue.

### Attempt #40: Isolate the `import()` Rewrite

**Hypothesis:** Rewriting `__vite_ssr_import__` to a dynamic `import()` call changes the execution timing in the Miniflare environment, contributing to the race condition.

**Plan:** Modify the `ssrBridgePlugin` to reconstruct the original `__vite_ssr_import__` call instead of replacing it with `import()`, while still prepending the virtual module prefix.

**Findings:** The "stale pre-bundle" error still occurred with the exact same stack trace.

**Conclusion:** This experiment definitively proves that our rewriting logic is **not** a contributing factor to the problem. The root cause is the timing of the `fetchModule` call itself, regardless of how the subsequent imports are structured. We can now proceed with the knowledge that the `import()` rewrite is safe and correct for its original purpose (module graph compatibility).

### Attempt #41: Tracing the `import()` Call

**Hypothesis:** The "stale pre-bundle" error originates from the resolution process that occurs inside the SSR environment, which is triggered by the worker's `import()` call to the virtual module.

**Plan:** Document the known facts and trace the code paths that are executed when the worker's `import()` call is handled by the Vite server, in order to identify un-logged code paths where the stale hash could be introduced.

**Findings & Thought Process:**
1.  We have proven from the `PROOF-2` logs that `rwsdk_worker.js` is correctly invalidated and re-transformed after a re-optimization.
2.  We have proven by inspecting the transformed code of `rwsdk_worker.js` that it contains no stale hashes. The import is clean: `import("/@id/virtual:rwsdk:ssr:rwsdk/__ssr_bridge")`.
3.  Therefore, the staleness must be introduced *after* this point, during the handling of that `import()` request.
4.  The request for the virtual module hits our `ssrBridgePlugin`'s `load` hook.
5.  Our `load` hook then calls `devServer.environments.ssr.fetchModule('rwsdk/__ssr_bridge')`.
6.  This triggers a new resolution process *inside the SSR environment*. It is within this separate, nested resolution that the stale hash is being generated, because it's running against the SSR environment's still-stale dependency optimizer state.

**Conclusion:** We need to add logging to the code paths within Vite's core resolution logic for the SSR environment to pinpoint where the stale state is being read. The next step is to identify the `resolveId` hook of Vite's internal `vite:resolve` plugin, as this is the function that will ultimately call `tryOptimizedResolve`.

### Attempt #42: The Final Diagnosis - Incomplete Module Graph Invalidation

**Hypothesis:** `moduleGraph.invalidateAll()` is not completely clearing the module graph. It leaves behind "ghost" `ModuleNode` objects that, while marked as invalidated (`transformResult: null`), still retain their original, stale `id`.

**Plan:** Add detailed logging inside Vite's `doTransform` function to inspect the state of the module graph when a request for the `ssr_bridge` comes in after a re-optimization.

**Findings: CONFIRMED**
The diagnostic logs (`LOG-10` and `LOG-11`) provided the definitive proof.

1.  `[RWS-VITE-LOG-10] doTransform found a module in moduleGraph for rwsdk/__ssr_bridge. Invalidated: true`
    *   This confirms that after `invalidateAll()` has been called, a `ModuleNode` for the bridge still exists in the SSR environment's graph, and that its `transformResult` has been correctly nullified.
2.  `[RWS-VITE-LOG-11] Using stale ID from ghost module node: .../rwsdk___ssr_bridge.js?v=2843178e`
    *   This is the smoking gun. It confirms that the "ghost" `ModuleNode` retains its original, stale `id` property, complete with the old version hash.

**The Root Cause & Full Trace:**

This is the final, definitive sequence of events that causes the crash:

A `ModuleNode` object acts as both a cache key (via its `url` property) and a cache container for its resolved `id`.

**1. First Run (Healthy State):**
- `doTransform` is called with a clean URL (e.g., `rwsdk/__ssr_bridge`).
- `moduleGraph.getModuleByUrl()` returns `null` because the module hasn't been seen before.
- The `pluginContainer.resolveId` pipeline runs completely.
- The `vite:resolve` plugin generates the fully resolved, versioned ID: `.../rwsdk___ssr_bridge.js?v=OLD_HASH`.
- A new `ModuleNode` is created. Its `url` property is set to the clean URL, but its `id` property is set to the stale, versioned ID.
- This new node is added to the `moduleGraph`'s internal `urlToModuleMap`.

**2. Re-optimization & Incomplete Invalidation:**
- A re-optimization occurs, creating a `NEW_HASH`.
- Our plugin intercepts the HMR event and calls `server.environments.ssr.moduleGraph.invalidateAll()`.
- `invalidateAll()` iterates through the `moduleGraph`. It finds our `ModuleNode` and sets its `transformResult` to `null`.
- Critically, it **does not** remove the node from the graph, nor does it clear the node's stale `id` property.

**3. Second Run (Failing State):**
- The runner re-imports, and `doTransform` is called again with the same clean URL (`rwsdk/__ssr_bridge`).
- `moduleGraph.getModuleByUrl()` now finds the "ghost" `ModuleNode` left behind from the first run. `module$1` is not `null`.
- **Resolution is Skipped:** Because a `ModuleNode` was found, `doTransform` completely skips the entire `pluginContainer.resolveId` pipeline. This is why our later diagnostic logs (`LOG-3`, `LOG-7`) were not firing.
- **Stale ID is Used:** `doTransform` then proceeds to use the properties of this stale "ghost" node, including its `id` property. It executes `const id = module$1.id`, which plucks the stale, version-hashed path (`.../rwsdk___ssr_bridge.js?v=OLD_HASH`) directly from the ghost node.
- **`loadAndTransform` Fails:** This stale, versioned ID is passed to `loadAndTransform`.
- **Error is Thrown:** `loadAndTransform` eventually reaches the `vite:optimized-deps` plugin's `load` hook. This hook sees the `OLD_HASH`, compares it to the new hash in the optimizer's current metadata, and correctly throws the "stale pre-bundle" error.

**Conclusion:** The diagnostic phase is complete. The root cause is an incomplete invalidation of the module graph by `invalidateAll()`. It is not designed to handle scenarios where the underlying resolution of a module's ID needs to change, as it leaves behind stale module nodes that poison subsequent requests. The solution must be to perform a more forceful and complete clearing of the module graph.

### Attempt #44: Co-ordinating the SSR and Worker Optimizers

After the "nuclear option" of clearing the module graphs failed, it became clear that the root of the problem is a fundamental de-synchronization between Vite's separate dependency optimizers for the `ssr` and `worker` environments. Our plugin creates an implicit dependency from the worker to the SSR environment that Vite is unaware of. When the SSR optimizer re-runs in response to a new dependency, the worker optimizer does not, leaving the two environments in an inconsistent state.

Two potential solutions were considered to address this architectural issue.

**Solution A: The "Blunt Hammer" - Linking Optimizers**

- **Concept:** Force the worker optimizer to re-run every time the SSR optimizer runs.
- **Mechanism:** Monkey-patch the SSR environment's `depsOptimizer.run` method to also trigger the worker's `depsOptimizer.run`.
- **Pros:** Guarantees the two environments are always synchronized.
- **Cons:**
  - Causes unnecessary and potentially slow worker re-optimizations.
  - The `run` methods are async with no completion callback, making reliable sequencing difficult. A hacky solution involving watching the `_metadata.json` files on the filesystem would be required.
  - Bypasses Vite's internal process, potentially missing important post-optimization cleanup steps for the worker environment.

**Solution B: The "Surgical Approach" - Intercepting Stale Resolutions**

- **Concept:** Prevent the worker from ever attempting to load a stale SSR dependency by correcting the import path just-in-time.
- **Mechanism:** Implement a `resolveId` hook in the `ssrBridgePlugin`.
- **Logic:** The hook will watch for resolutions of our virtual SSR modules. If it sees one that already has a version hash (`?v=...`), it signifies a potentially stale import from an already-transformed module. The hook will strip this stale hash and return the clean ID to the resolver pipeline. This forces a fresh resolution, which will then append the *latest* hash from the now-updated SSR optimizer metadata.
- **Pros:**
  - More efficient and less disruptive than a full worker re-optimization.
  - Works within Vite's standard plugin APIs.
  - Avoids complex and potentially flaky filesystem watching.
- **Cons: Relies on correctly identifying and stripping the hash from all relevant imports.

**Decision:** The "Surgical Approach" (Solution B) was chosen as the first to implement, as it is significantly cleaner and less of a hack than Solution A.

### Attempt #45: Investigating Stale Transform Caching

With both the `.send` HMR forwarding and the "surgical" `resolveId` hash stripping in place, I continued to investigate the logs.

**Findings:**

I've identified a definitive sequence of events in the logs that pinpoints the root cause:

1.  At `2025-10-20T01:25:57.545Z` (L33953 in the logs), immediately after a file change HMR event, I see a "Fetch module result" for `ClientComponent.tsx`. The transformed code for this module correctly contains an import for `react.js` with the current hash:
    ```
    const __vite_ssr_import_2__ = await __vite_ssr_import__("/node_modules/.vite/deps_ssr/react.js?v=9c4d658f", {"importedNames":["default"]});
    ```
2.  Shortly after, at `2025-10-20T01:25:57.713Z` (L34652), a dependency re-optimization is triggered for the `ssr` environment.
3.  Following this, the `.send` forwarding correctly triggers a `full-reload` in the worker, and I can see the worker's module runner re-executing its entry points.
4.  **Crucially, there is no subsequent "Fetch module result" log for `ClientComponent.tsx` after the re-optimization event.**

**Conclusion:**

This confirms that the worker is re-executing a *stale transform* of `ClientComponent.tsx`. Vite is serving a cached version of this module's transformed code. This cached code contains the old, now-stale import for `react.js?v=9c4d658f`.

When the worker executes this stale code, it makes a request for the stale dependency. Our `resolveId` hash-stripping logic is irrelevant at this stage, because the stale URL is baked into the importer's code, and the resolution for *that* module has already completed. The problem is that the importer itself is stale.

### Attempt #46: Force Invalidation on Both Environments

**Hypothesis:** The stale transform of `ClientComponent.tsx` is being served because we were only invalidating the SSR module graph. Invalidating both the SSR and worker module graphs should force Vite to re-transform the module.

**Plan:** Inside the `.send` monkey-patch, call `invalidateAll()` on both `server.environments.ssr.moduleGraph` and `server.environments.worker.moduleGraph` when a `full-reload` is detected.

**Findings:**

I've analyzed the new logs (`/tmp/state2.log`) after implementing this change.

1.  At line `34652`, the SSR dependency re-optimization event occurs as expected.
2.  The `.send` patch is triggered, and `invalidateAll()` is called for both environments.
3.  However, the "Fetch module result" log for `ClientComponent.tsx` still only appears once, at line `33948`, which is *before* the re-optimization.
4.  There is no second fetch after the invalidation and reload.

**Conclusion:**

This is a significant finding. Even when explicitly invalidating both the SSR and worker module graphs, Vite is still serving a cached, stale version of `ClientComponent.tsx`. This proves that `moduleGraph.invalidateAll()` is insufficient for our needs and that another, more persistent caching mechanism is at play. The investigation must now focus on identifying and clearing this other cache. My next attempt will be to try a more forceful, manual module cache clearing within the `.send` handler.

### Attempt #47: Analyzing the "Ghost Node" Regression

Following the implementation of `invalidateAll()` on both module graphs (Attempt #46), a significant change in behavior was observed.

**Findings:**

The "stale pre-bundle" error for `react.js` was resolved. However, the error regressed to a much earlier problem: a stale pre-bundle error for `rwsdk___ssr_bridge.js`.

The logs show the following sequence:
1. The `react.js` dependency is resolved successfully (implicitly, as the error no longer mentions it).
2. The process continues until it needs to resolve the `ssr_bridge`.
3. At this point, a log confirms the root cause: `[RWS-VITE-LOG-11] Using stale ID from ghost module node: .../rwsdk___ssr_bridge.js?v=732d043a`
4. This leads directly to the "stale pre-bundle" error for the bridge.

**Conclusion:**

This is a critical breakthrough. It proves two things:
1.  Calling `invalidateAll()` on both graphs *was* effective enough to force a re-transform of the top-level importer (`ClientComponent.tsx`), which fixed the stale `react.js` import baked into it.
2.  However, this invalidation is not "deep" enough. It does not force a fresh resolution of the modules that the re-transformed component *imports*. The `ssr_bridge` is still being looked up via the stale "ghost" `ModuleNode` that persists in the SSR module graph.

The problem is now narrowed down to a single point of failure: the incomplete clearing of the `ModuleNode` for the `ssr_bridge` itself.

### Attempt #48: Forceful Cache Clearing and Deeper Analysis

**Hypothesis:** The only way to ensure a fresh state is to bypass `invalidateAll()` and manually clear the module graph's internal caches entirely.

**Plan:** In the `.send` monkey-patch, instead of calling `invalidateAll()`, manually call `.clear()` on the four key maps of both the SSR and worker module graphs: `urlToModuleMap`, `idToModuleMap`, `fileToModulesMap`, and `_unresolvedUrlToModuleMap`.

**Findings & Analysis:**

This approach was partially successful and led to a much deeper understanding of Vite's internal mechanics.

1.  **Success:** Forcefully clearing the module graph caches **works**. The logs now show two "Fetch module result" logs for `ClientComponent.tsx`, one before the re-optimization and one after. This confirms that wiping the caches forces Vite to re-process the importer module from scratch.
2.  **New Failure:** The "stale pre-bundle" error immediately returned, but this time for a deeper dependency: `is-number.js`. This is predictable: we fixed the stale `react.js` import inside `ClientComponent.tsx`, and we fixed the stale `ssr_bridge` import, but now we're hitting the stale imports *inside* the `ssr_bridge`'s dependency graph.
3.  **Core Question:** This success raised a critical question: Why is this forceful clearing necessary? What does Vite do internally after a re-optimization, and why is `invalidateAll()` insufficient for our use case? A simple `invalidateAll()` should nullify a module's `transformResult`, which *should* trigger a re-fetch. Why doesn't it?

The investigation now shifts from "how to fix this" to "why is Vite designed this way, and how does our specific cross-environment setup break its assumptions?"

### Final Diagnosis: The "Ghost Node" Failure Sequence

A complete analysis of the logs and Vite's internal source code reveals the precise, step-by-step failure sequence that occurs when we only use `invalidateAll()` instead of forcefully clearing the module graph caches.

1.  **Initial Load & Module Creation:** On the first request, the `worker` environment imports `rwsdk_worker.js`, which in turn needs the `ssr_bridge`. Our `ssrBridgePlugin`'s `load` hook is called, and it requests `rwsdk/__ssr_bridge` from the `ssr` environment. Vite's resolver pipeline runs, determines this is an optimized dependency, and resolves it to its versioned path (e.g., `.../deps_ssr/rwsdk___ssr_bridge.js?v=OLD_HASH`). A new `ModuleNode` is created in the `ssr` module graph. This node's `url` is the clean path (`rwsdk/__ssr_bridge`), but its `id` is the stale, versioned path. This node is stored in the graph's internal maps.

2.  **Re-optimization:** A new dependency is discovered (e.g., `is-number`), triggering the `ssr` dependency optimizer. It runs and creates a `NEW_HASH` for all optimized SSR dependencies.

3.  **HMR & Incomplete Invalidation:** The optimizer broadcasts a `full-reload` message. Our patch in `ssrBridgePlugin` intercepts this and calls `server.environments.ssr.moduleGraph.invalidateAll()`. This function iterates through the graph, finds the `ModuleNode` for `rwsdk/__ssr_bridge`, and sets its `transformResult` to `null`. Critically, it **leaves the "ghost node" itself in the graph**, complete with its stale `id` property containing `OLD_HASH`.

4.  **Runner Re-import:** Our patch also forwards the `full-reload` to the worker's `CustomModuleRunner`. The runner clears its `evaluatedModules` cache and immediately begins re-importing its entry point to get back to a working state. This eventually leads to a request for `rwsdk_worker.js`, which then re-imports the `ssr_bridge`.

5.  **The Failure Point:** The request for the `ssr_bridge` hits our `ssrBridgePlugin`'s `load` hook again, which calls `fetchModule('rwsdk/__ssr_bridge')` in the `ssr` environment.
    *   Vite's `transformRequest` function receives this request and looks up the clean URL (`rwsdk/__ssr_bridge`) in the `ssr` module graph's `urlToModuleMap`.
    *   **It gets a hit.** It finds the "ghost node" left behind in step 3.
    *   Because a node was found, Vite takes a shortcut. It **skips the entire `resolveId` plugin pipeline** for this module, assuming its identity is unchanged.
    *   It then proceeds using the properties from the ghost node, including its stale `id`: `.../deps_ssr/rwsdk___ssr_bridge.js?v=OLD_HASH`.

6.  **The Crash:** This stale, versioned ID is passed to the `load` pipeline. The `vite:optimized-deps` plugin receives it, compares the `OLD_HASH` to the optimizer's current `NEW_HASH`, sees the mismatch, and throws the "stale pre-bundle" error.

This sequence confirms that the problem is not that the module isn't being re-evaluated, but that the re-evaluation is being poisoned by a stale ID from a "ghost node" that survives the standard invalidation process.

### Deeper Analysis: Why `invalidateAll()` is Insufficient

My initial forceful cache-clearing worked but was a blunt instrument. The key question was why Vite's standard `moduleGraph.invalidateAll()` was not enough to prevent the stale module error. The investigation revealed a subtle but critical failure mode related to "ghost nodes" left behind after invalidation.

When `invalidateAll()` is called, it iterates through every module in the graph and sets its `transformResult` to `null`. However, it does **not** remove the module node itself from the graph's internal maps (`idToModuleMap`, `urlToModuleMap`, etc.). The node persists, but in an "invalidated" state.

Normally, this is fine. When a request comes in for an invalidated module, Vite sees the `null` transform result and re-processes it from scratch.

### Final Diagnosis: The 'Ghost Node' and the Unhashed-to-Hashed Transition

The problem in our specific case is a combination of the ghost node and the unique way the `ssr_bridge` module is resolved across environments.

Here is the exact failure sequence:

1.  **Initial State:** The `ssr` module graph contains a valid node for `rwsdk/__ssr_bridge`. This node has a URL (`virtual:rwsdk:ssr:rwsdk/__ssr_bridge`) and a resolved ID (`/.../deps_ssr/rwsdk___ssr_bridge.js?v=OLD_HASH`).
2.  **Re-optimization:** A dependency changes, and Vite's SSR optimizer runs. It creates a `NEW_HASH`.
3.  **Invalidation:** Vite calls `fullReload()`, which calls `server.environments.ssr.moduleGraph.invalidateAll()`. Our HMR patch propagates this, calling `invalidateAll()` on the worker graph too.
4.  **Ghost Node Created:** The `ssr_bridge` node in the SSR module graph is now a "ghost". Its `transformResult` is `null`, but its `id` property still holds the stale `/.../deps_ssr/rwsdk___ssr_bridge.js?v=OLD_HASH`.
5.  **Worker Re-import:** The Cloudflare module runner receives the `full-reload` and immediately re-imports its entry point (`/src/worker.tsx`).
6.  **Resolution Jumps Environments:** The worker code eventually imports the clean, un-hashed ID `rwsdk/__ssr_bridge`. Our `ssrBridgePlugin`'s `load` hook intercepts this and calls `devServer.environments.ssr.fetchModule('rwsdk/__ssr_bridge')`.
7.  **Ghost Node is Used:** This `fetchModule` call triggers Vite's `transformRequest` pipeline *within the SSR environment*. `transformRequest` looks up `rwsdk/__ssr_bridge` in the SSR module graph. It finds the ghost node. Because the node was found (even though it's invalidated), Vite re-uses its existing, stale `id` property (`...v=OLD_HASH`) as the basis for the subsequent processing.
8.  **Stale Error:** The runner receives this stale, hashed path, compares it to the new optimizer hash, and throws the "stale pre-bundle" error.

This "unhashed-to-hashed" transition is the critical flaw. Standard Vite modules are always referenced by their hashed path after initial transformation, so this specific type of ghost node re-use doesn't occur. Our cross-environment bridge creates a scenario Vite's invalidation logic doesn't account for. The solution is to ensure that when we `fetchModule`, we are already providing the correct, up-to-date hashed path, avoiding the faulty ghost node lookup entirely.

## Attempt #49: Manually Resolving the Hashed Path

Based on the final diagnosis, the plan is to fix the "unhashed-to-hashed" transition. Instead of asking the SSR environment to resolve the clean `rwsdk/__ssr_bridge` ID (which triggers the ghost node problem), I will resolve it to its correct, hashed path *within the worker environment's `load` hook* and then pass that fully-resolved path to `fetchModule`.

This makes the interaction between the two environments explicit and avoids relying on Vite's internal resolution, which is failing in this cross-environment scenario. I've also decided to use `cached: false` in the `fetchModule` call. This is a "belt-and-suspenders" measure. Since our `load` hook is only called when the worker-side cache is stale, this flag ensures we also bypass any potentially stale transform result in the SSR environment's cache, guaranteeing we get the absolute freshest version.

**Findings:** This was a major success. The "stale pre-bundle" error for `rwsdk/__ssr_bridge` is now completely gone.

However, this has unmasked a pre-existing, identical error for the `react` dependency. The logs show that this error was always happening, but was previously hidden by the more immediate failure of the SSR bridge.

Crucially, if I manually reload the page in the browser after the `react` error appears in the console, the page loads correctly. This is a strong indicator that the server *does* eventually reach a consistent state, and the core issue is a race condition where the worker's module runner re-imports modules too quickly after a re-optimization, before the Vite server has stabilized.

## Attempt #50: Signal and Retry on Stale Dependency Error

The current problem is a classic race condition. The fix for the SSR bridge was correct, but now we must address the timing issue for all other dependencies. When the SSR optimizer runs, it sends a `full-reload` HMR message, which our plugin forwards to the worker. The worker's `CustomModuleRunner` immediately clears its caches and re-imports its entry points, often before the Vite dev server has finished its own internal state updates.

The plan is to implement a retry mechanism.

1.  **Create a Signal:** In `ssrBridgePlugin`, where we intercept the `full-reload` HMR event, we will create a promise that acts as a "server is stable" signal. Initially, this will resolve after a short, fixed delay to prove the theory.
2.  **Implement Retry Logic:** We will need to modify the `CustomModuleRunner`'s `cachedModule` function (where the error originates). We'll wrap the module request in a `try...catch`.
3.  **Connect Signal and Retry:** If a "stale pre-bundle" error is caught, the runner will `await` our stability signal promise and then retry the request.
