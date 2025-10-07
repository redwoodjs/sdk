# Investigating SSR Module and Hook Errors

**Date**: 2025-10-06

## Context

I'm working through the steps of a presentation demo script for a sample application to ensure the flow is correct. The process involves incrementally enabling features in `src/worker.tsx` to showcase the framework's capabilities, moving from simple server-side rendering to a fully interactive, real-time application.

The progression is as follows:
1.  **Basic SSR & Middleware**: Simple, non-interactive pages.
2.  **API and Simple Todos**: Server-rendered forms posting to API routes.
3.  **Client-Side Hydration & Auth**: Introducing a client-side JS bundle for interactivity on some routes.
4.  **"Fancy" Todos**: A more complex, interactive page using modern React features.
5.  **Real-Time**: A page with WebSocket-based real-time updates.

The first three steps proceeded as expected.

## Problem

Upon enabling the routes for Step 4 ("Fancy Todos") and Step 5 ("Real-time"), the development server began throwing errors during server-side rendering (SSR).

The initial error reported by Vite is a module resolution failure:

```
Internal server error: (ssr) No module found for '/src/app/pages/todos/Todos.tsx' in module lookup for "use client" directive
```

A similar error was observed for `/src/app/pages/todos/TodoItem.tsx`.

This appears to cause a downstream React error during rendering: `Invalid hook call`, which manifests as `TypeError: Cannot read properties of null (reading 'use')` and `TypeError: Cannot read properties of null (reading 'useOptimistic')`.

## Deeper Analysis

The root cause is the pre-build directive scan becoming stale. The initial scan at server startup correctly identifies all client components reachable from the initial entry points. However, if a code change introduces a *new dependency path* that was not previously part of the graph, the HMR update does not trigger a re-scan.

This means that if a module is edited to import a new component that contains a `"use client"` directive (or transitively imports one), the running server's list of client components is not updated. This leads to the "No module found" error during SSR. A server restart fixes this because it forces a fresh, complete scan.

## Refined Path Forward

The "correct," long-term solution would be to implement an intelligent, cached re-scan on HMR updates that can walk newly formed dependency branches. This is a complex task.

Given the time-critical nature of the presentation, a more surgical and pragmatic approach is needed. The plan is to augment the entry points for the existing `esbuild`-based scan by refactoring the scan logic.

1.  **Refactor into a Helper**: The glob-based search for directive files will be extracted into a dedicated `findDirectiveRoots` function.
2.  **Pre-Scan for Directive Roots**: This function will perform a fast glob search across the application's `src` directory to find all potential script files (`.js`, `.ts`, `.mdx`, etc.).
3.  **Combine Entry Points**: The main `runDirectivesScan` function will call this helper and merge its results with the original worker entry points. The main `esbuild` scan will then run with this combined, comprehensive set of entry points.
4.  **Shared Caching**: To make this performant, a single `fileContentCache` will be used for both the pre-scan and the main scan, preventing duplicate file reads. Furthermore, a `directiveCheckCache` will be introduced to memoize the result of checking a file for directives, avoiding redundant checks on the same content.

This approach guarantees that even if a directive-marked file is not yet reachable from the main entry point, it is included in the scan. This effectively "future-proofs" the scan against any subsequent code change that might link it into the main dependency graph, ensuring the server is always aware of all potential client and server components.

## Attempt 1: Implementation and Failure

My first implementation of `findDirectiveRoots` failed. Debug logs showed that the glob search was returning an empty array of files, even in a stable Step 3 configuration. This was the "smoking gun," indicating the problem was with the glob pattern or its options, not the overall strategy.

A search of the git history for previous `glob` implementations surfaced an older, working version in commit `c30a8119`. Comparing the two revealed the likely issue: my implementation used `path.join` to construct the `cwd` (current working directory) for the glob, whereas the older, successful implementation used `path.resolve`. The `glob` library can be sensitive to how its `cwd` is specified, and `path.resolve` provides a more robust, absolute path.

My next attempt will correct this, using `path.resolve` and adopting the pattern syntax from the previous implementation as a safeguard.

## Resolution

The second attempt was successful. Using `path.resolve` for the `cwd` in the glob search immediately fixed the pre-scan, which now correctly identifies all directive-containing files on startup.

With the pre-scan working, advancing to Step 4 of the demo no longer produces the "(ssr) No module found" error. The underlying issue of the stale directive map is now resolved for the purposes of the demo.

## New Issue: Worker Hanging

While the directive scan is now fixed, a new issue has surfaced. When the `FancyTodosPage` is loaded, the worker hangs, eventually timing out with the error:

```
The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response.
```

The logs also show a related warning concerning cross-request promise resolution and a stack trace that points to `@prisma/client/runtime/wasm.js`.

This suggests a potential incompatibility or race condition between Prisma's WASM-based query engine and the Miniflare/Cloudflare Workers runtime, specifically how it handles async operations within a request context. This is the next issue to investigate.

## Investigation Path 1: `AbortSignal` Refactor

My initial line of investigation focused on the SDK's render control flow.

1.  **Hypothesis:** The hang was caused by the `await rw.pageRouteResolved?.promise;` line in `worker.tsx`. This custom deferred promise, designed to handle render short-circuiting (e.g., for redirects), becomes a "dangling promise" when the render stream hangs silently. The `await` waits forever, causing the worker timeout.

2.  **Proposed Solution:** It was correctly identified that this custom promise was architecturally fragile. The correct, platform-native solution is to use a standard `AbortController` and `AbortSignal`, as React's `renderToReadableStream` API is designed to accept an `AbortSignal`.

3.  **Action:** I refactored the SDK runtime to replace the `pageRouteResolved` promise with an `AbortController`. This involved updating `router.ts` to create the controller and call `.abort()` on short-circuits, updating `worker.tsx` to remove the `await`, and plumbing the `signal` down to the render functions.

4.  **Result:** The refactoring was complex and initially flawed (I incorrectly aborted successful renders), but even after correcting the implementation, the underlying worker hang **persisted**. This proved that while the `AbortSignal` refactor is a valuable architectural improvement for the future, it was not a fix for the immediate problem. I have reverted these changes to isolate the root cause.

// ... existing code ...
    75|This suggests a potential incompatibility or race condition between Prisma's WASM-based query engine and the Miniflare/Cloudflare Workers runtime, specifically how it handles async operations within a request context. This is the next issue to investigate.

## Red Herring: Vite Dependency Optimization

While investigating the worker hang, I noticed a Vite log message that seemed significant: `✨ new dependencies optimized: rwsdk/router`. This suggested that Vite was discovering our internal SDK entry points at runtime and performing a costly re-optimization, a known cause of instability.

This led down a significant, but ultimately incorrect, path:

1.  **Hypothesis:** The runtime re-optimization was the root cause of the instability and the hang.
2.  **Action:** I refactored the SDK's Vite plugin (`sdk/src/vite/configPlugin.mts`) to dynamically read our own `sdk/package.json`, generate a complete list of all internal `rwsdk/*` exports, and feed this list into the `optimizeDeps.include` array for all environments.
3.  **Result:** The implementation was successful in preventing the re-optimization log message from appearing. However, the underlying worker hanging issue on the Todos page **persisted**.

This proves that the Vite re-optimization, while non-ideal, was a red herring and not the root cause of the Prisma-related hang. I have since reverted the changes to the Vite config to avoid unnecessary complexity. We are now back to focusing on the original problem: the silent hang within the render stream.
 Deeper Analysis

The root cause is the pre-build directive scan becoming stale. The initial scan at server startup correctly identifies all client components reachable from the initial entry points. However, if a code change introduces a *new dependency path* that was not previously part of the graph, the HMR update does not trigger a re-scan.

This means that if a module is edited to import a new component that contains a `"use client"` directive (or transitively imports one), the running server's list of client components is not updated. This leads to the "No module found" error during SSR. A server restart fixes this because it forces a fresh, complete scan.

## Refined Path Forward

The "correct," long-term solution would be to implement an intelligent, cached re-scan on HMR updates that can walk newly formed dependency branches. This is a complex task.

Given the time-critical nature of the presentation, a more surgical and pragmatic approach is needed. The plan is to augment the entry points for the existing `esbuild`-based scan by refactoring the scan logic.

1.  **Refactor into a Helper**: The glob-based search for directive files will be extracted into a dedicated `findDirectiveRoots` function.
2.  **Pre-Scan for Directive Roots**: This function will perform a fast glob search across the application's `src` directory to find all potential script files (`.js`, `.ts`, `.mdx`, etc.).
3.  **Combine Entry Points**: The main `runDirectivesScan` function will call this helper and merge its results with the original worker entry points. The main `esbuild` scan will then run with this combined, comprehensive set of entry points.
4.  **Shared Caching**: To make this performant, a single `fileContentCache` will be used for both the pre-scan and the main scan, preventing duplicate file reads. Furthermore, a `directiveCheckCache` will be introduced to memoize the result of checking a file for directives, avoiding redundant checks on the same content.

This approach guarantees that even if a directive-marked file is not yet reachable from the main entry point, it is included in the scan. This effectively "future-proofs" the scan against any subsequent code change that might link it into the main dependency graph, ensuring the server is always aware of all potential client and server components.

## Attempt 1: Implementation and Failure

My first implementation of `findDirectiveRoots` failed. Debug logs showed that the glob search was returning an empty array of files, even in a stable Step 3 configuration. This was the "smoking gun," indicating the problem was with the glob pattern or its options, not the overall strategy.

A search of the git history for previous `glob` implementations surfaced an older, working version in commit `c30a8119`. Comparing the two revealed the likely issue: my implementation used `path.join` to construct the `cwd` (current working directory) for the glob, whereas the older, successful implementation used `path.resolve`. The `glob` library can be sensitive to how its `cwd` is specified, and `path.resolve` provides a more robust, absolute path.

My next attempt will correct this, using `path.resolve` and adopting the pattern syntax from the previous implementation as a safeguard.

## Resolution

The second attempt was successful. Using `path.resolve` for the `cwd` in the glob search immediately fixed the pre-scan, which now correctly identifies all directive-containing files on startup.

With the pre-scan working, advancing to Step 4 of the demo no longer produces the "(ssr) No module found" error. The underlying issue of the stale directive map is now resolved for the purposes of the demo.

## New Issue: Worker Hanging

While the directive scan is now fixed, a new issue has surfaced. When the `FancyTodosPage` is loaded, the worker hangs, eventually timing out with the error:

```
The Workers runtime canceled this request because it detected that your Worker's code had hung and would never generate a response.
```

The logs also show a related warning concerning cross-request promise resolution and a stack trace that points to `@prisma/client/runtime/wasm.js`.

This suggests a potential incompatibility or race condition between Prisma's WASM-based query engine and the Miniflare/Cloudflare Workers runtime, specifically how it handles async operations within a request context. This is the next issue to investigate.

## Red Herring: Vite Dependency Optimization

While investigating the worker hang, I noticed a Vite log message that seemed significant: `✨ new dependencies optimized: rwsdk/router`. This suggested that Vite was discovering our internal SDK entry points at runtime and performing a costly re-optimization, a known cause of instability.

This led down a significant, but ultimately incorrect, path:

1.  **Hypothesis:** The runtime re-optimization was the root cause of the instability and the hang.
2.  **Action:** I refactored the SDK's Vite plugin (`sdk/src/vite/configPlugin.mts`) to dynamically read our own `sdk/package.json`, generate a complete list of all internal `rwsdk/*` exports, and feed this list into the `optimizeDeps.include` array for all environments.
3.  **Result:** The implementation was successful in preventing the re-optimization log message from appearing. However, the underlying worker hanging issue on the Todos page **persisted**.

This proves that the Vite re-optimization, while non-ideal, was a red herring and not the root cause of the Prisma-related hang. I have since reverted the changes to the Vite config to avoid unnecessary complexity. We are now back to focusing on the original problem: the silent hang within the render stream.

## Investigation Path 2: Stream Error Logging

Another hypothesis was that an error was being silently swallowed within the stream stitching logic, preventing it from being logged.

1.  **Action**: Added a `console.error` to the central `catch` block of `sdk/src/runtime/lib/stitchDocumentAndAppStreams.ts`.
2.  **Result**: This did not surface any new errors. This confirmed that the render stream itself was not throwing an error but was hanging silently *before* an error could be generated and propagated.

## Investigation Path 3: Request-Scoped Prisma Client

The warning message-"A promise was resolved or rejected from a different request context"-is the critical clue. It confirms the problem isn't a silent hang, but a state management issue within Prisma's query engine, triggered by sharing a single client instance across multiple concurrent requests.

This is a familiar pattern. The internal `rwsdk/db` implementation was designed specifically to avoid this by scoping database access to the individual request, preventing state leakage. The same principle should apply here.

The next attempt will be to refactor the application to create a new `PrismaClient` for each request, rather than using a shared singleton. This aligns with best practices for serverless environments and directly addresses the likely cause of the state corruption.

## Discovery: Request-Scoped Database Pattern Was Removed

Research into the git history revealed that the request-scoped database pattern was indeed implemented and working correctly in the `rwsdk/db` implementation. The `databases` Map in `RwContext` was used to cache database instances per request, preventing state leakage between concurrent requests.

However, this pattern was removed in commit `0e85b4a6` ("fix: `createDb()` in `queue()` handlers") on August 11, 2025. The commit message explains that the change was made to fix cross-event I/O errors in queue handlers by obtaining fresh stubs at query time, but it also removed the request-scoped caching mechanism entirely.

The current `createDb` implementation now creates a new `Kysely` instance on every call, which means each database operation gets a fresh instance. While this works for the `rwsdk/db` implementation (which uses Durable Objects), it doesn't solve the Prisma singleton problem in the demo application.

The solution is to restore the request-scoped pattern for Prisma, using the existing `databases` Map infrastructure that's still present in `RwContext` but currently unused.

## Proposed Solution: AsyncLocalStorage-Based Request State

The current Prisma singleton pattern (`export let db: PrismaClient`) creates a module-level instance that gets reused across concurrent requests, causing state corruption. We need to make it request-scoped.

The SDK already has an excellent pattern for this with `requestInfo` using `AsyncLocalStorage`. We can extend this pattern to provide a generic request state management API.

### Proposed API

```ts
// User's code
export const [db, setDb] = defineRequestState<PrismaClient>()

export const setupDb = async (env: Env) => {
  setDb(new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  }))
}
```

### Implementation Approach

1. **Extend RequestInfo**: Add a generic `__userContext` property to the request info structure
2. **Create `defineRequestState`**: A function that returns a getter/setter pair tied to the current request context
3. **Use AsyncLocalStorage**: Leverage the existing `requestInfoStore` to isolate state per request
4. **Generate Unique Keys**: Use unique identifiers to prevent name collisions

This approach would:
- Eliminate the module-level singleton problem
- Provide a clean, reusable API for request-scoped state
- Leverage existing infrastructure (AsyncLocalStorage, requestInfo)
- Be transparent to the user (no changes to how they use `db`)

The implementation would create a proxy that automatically resolves to the correct instance based on the current request context, similar to how `requestInfo.rw` works.

## Solution Implemented: Proxy-Based Request-Scoped State

**Date**: 2025-01-06  
**Status**: ✅ **SOLVED**

### Final Implementation

After several iterations, the solution was successfully implemented using a proxy-based approach:

1. **Extended RequestInfo**: Added `__userContext: Record<string, any>` to the `RequestInfo` interface
2. **Initialized User Context**: Modified `worker.tsx` to initialize `__userContext: {}` for each request
3. **Created `defineRequestState` API**: Implemented a function that returns a proxy object and setter function
4. **Proxy Implementation**: The proxy delegates all property access to the request-scoped instance stored in `requestInfo.__userContext`

### Key Technical Details

- **Proxy Object**: Instead of returning a getter function, `defineRequestState` now returns a proxy that behaves exactly like the target object
- **Method Binding**: Proxy correctly binds methods to their original context using `.bind(instance)`
- **Unique Keys**: Uses `crypto.randomUUID()` to generate collision-resistant keys
- **Error Handling**: Provides clear error messages when state is accessed before initialization

### Demo Application Changes

```typescript
// Before: Module-level singleton (problematic)
export const db = new PrismaClient({...});

// After: Request-scoped proxy
export const [db, setDb] = defineRequestState<PrismaClient>();
export const setupDb = async (env: Env) => {
  const client = new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });
  await client.$queryRaw`SELECT 1`;
  setDb(client); // Store in request context
};
```

### Result

**Worker hanging issue resolved**  
**Cross-request promise resolution warning eliminated**  
**Prisma client now properly isolated per request**  
**No changes required to existing database usage patterns**

The proxy approach ensures that `db.findUnique()`, `db.create()`, etc. all work transparently while being properly scoped to each individual request, preventing the state corruption that was causing the worker to hang.

### Additional Context

**Why This Happens**: The module-level `export let db` pattern for Prisma is something that should work in theory (and indeed how the starter template had it), but Cloudflare Workers have technical restrictions that make execution context tied to the current request. This creates complications when multiple requests try to share the same PrismaClient instance.

**Real-World Impact**: This explains why the issue was particularly noticeable with realtime features + multiple clients + rapid button interactions - these scenarios create lots of opportunities for context bound to one request to interfere with another incoming request.

**The Solution**: While the module-level singleton pattern is problematic in Cloudflare Workers, it can still be achieved through request-scoped state management using AsyncLocalStorage, which maintains the same developer experience while ensuring proper isolation.