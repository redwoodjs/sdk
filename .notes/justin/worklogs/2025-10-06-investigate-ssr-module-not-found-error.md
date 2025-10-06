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
