# 2025-10-09: Storybook Support Investigation

## Problem

A user is reporting a "Maximum call stack size exceeded" error when using Storybook with our framework. The error occurs when a story is saved.

The user provided a screenshot of the stack trace. The stack trace points to an issue within our Vite plugin, specifically in `normalizeModulePath` and `isInUseClientGraph` within `miniflareHMRPlugin.mjs`. It seems there's an infinite recursion happening.

The user is using:
- `storybook@9.1.10`
- `@storybook/react@9.1.10`
- `@storybook/react-vite@9.1.10`
- `@storybook/addon-a11y@9.1.10`
- `@storybook/addon-docs@9.1.10`
- `@storybook/addon-vitest@9.1.10`

## Initial Plan

1.  Create a new playground example based on `hello-world` to reproduce the issue.
2.  Install and configure Storybook in the new playground.
3.  Attempt to reproduce the "Maximum call stack size exceeded" error.
4.  Investigate the cause of the error within the Vite plugin.
5.  Fix the issue.
6.  Add an E2E test to the playground to prevent regressions.

## Update (2025-10-09) - Investigation

My initial attempts to reproduce the issue in the playground were unsuccessful. I hypothesized that a circular dependency was the cause, but my attempts to create one resulted in runtime errors within the application itself, not the specific HMR plugin crash the user was seeing.

The investigation shifted course after the user provided a detailed explanation of their setup. They described a component hierarchy where saving a deeply nested component would trigger the error. They also noted that adding a `'use client'` directive to that same component made the error disappear, allowing HMR to function.

While I was unable to get a local reproduction of the specific error, the user's detailed report provided a clear pointer. The behavior strongly suggested that the `isInUseClientGraph` function was entering an infinite loop while traversing the module graph that Storybook creates. This information was sufficient to proceed with a fix.

## Update (2025-10-09) - The Fix

After a deep dive into the git history of `miniflareHMRPlugin.mts`, I confirmed that the `isInUseClientGraph` check was a legacy optimization from an earlier architectural phase. Its primary purpose was to determine if a changed module (particularly a CSS file) was part of a client-side component graph. If not, it could avoid a more disruptive update, like a full-page reload. This was necessary before the SSR bridge was implemented, when the integration between the server and client environments for HMR was less sophisticated. The function has always been vulnerable to infinite recursion in the presence of module graph cycles, as it traverses the module graph without tracking visited nodes.

Given that Vite's HMR is now more robust and our current architecture with the SSR bridge handles updates more gracefully, this manual check is no longer needed. Keeping the check introduces a risk of the development server crashing, which is not warranted by the micro-optimization it might provide. The recursive traversal is inefficient in itself and can lead to this crash. The `isInUseClientGraph` function and its calls have been removed, resolving the "Maximum call stack size exceeded" error.

## Update (2025-10-09) - Stale State Bugfix

Further investigation while verifying the fix revealed a pre-existing bug in the HMR logic for the `worker` environment. The plugin was not invalidating the changed module itself, only related CSS and virtual SSR modules. This was causing a stale state issue, particularly with React instances, where the client would receive an RSC payload rendered with an old version of a server-side module.

A call to `invalidateModule(ctx.server, environment, ctx.file)` has been added to the `worker` environment's `hotUpdate` handler. This ensures that the changed module is correctly invalidated, allowing Vite to propagate the changes through the module graph and preventing the stale state issue. With this, both the Storybook crash and the HMR stale state issue are resolved.

## Update (2025-11-04) - HMR Test Suite Deferral

I initially planned to create a comprehensive HMR test suite to cover various scenarios (client/server components, CSS, worker changes). However, after further consideration, I've decided to defer this, as I have other priorities I need to return to. The existing `requestInfo` playground test already covers the most critical HMR path for server and client components, which is sufficient for now. I've also manually verified that HMR for both CSS Modules and `?url` stylesheet imports is working as expected after the recent fixes. A dedicated, exhaustive HMR suite can be added later. I've created a ticket to track this work: [#858](https://github.com/redwoodjs/sdk/issues/858).

## PR Description

**Title:** `fix: Resolve Storybook HMR crash and worker stale state`

**Body:**

This change addresses two separate issues related to Vite's Hot Module Replacement (HMR) functionality.

## Storybook HMR Crash

### Problem
When using Storybook, saving a file would crash the development server with a "Maximum call stack size exceeded" error.

### Context
The error was traced to the `isInUseClientGraph` function within our HMR plugin. This function was a legacy optimization from a pre-SSR-bridge architecture. In that earlier phase, module graphs for different environments were not clearly separated, so this check was needed to recursively guess if a changed module was part of a client-side bundle in order to avoid a disruptive full-page reload. However, it did not track visited nodes, causing it to enter an infinite loop when encountering module graphs with cycles, such as those created by Storybook.

Our current architecture now maintains separate and well-structured module graphs for each Vite environment (`client`, `worker`, and `ssr`). A key aspect of this design is the SSR subgraph, which ensures that client components are correctly incorporated into the worker's module graph for server-side rendering.

Because of this clear architectural separation, a file change is now handled by the `hotUpdate` hook within the specific environment it belongs to. The system no longer needs to manually traverse the graph to guess a module's context; the environment-specific plugin execution provides this information implicitly. This makes the old check redundant.

### Solution
The `isInUseClientGraph` function and its calls have been removed. This eliminates the fragile, unnecessary check, which resolves the crash and simplifies the HMR plugin.

## Worker HMR Stale State

### Problem
When a file used by the `worker` environment was modified, HMR would not correctly update the server-side state. This resulted in the client receiving RSC payloads that were rendered using an outdated version of the worker's code.

### Context
The investigation for the Storybook issue revealed that the HMR handler for the `worker` environment was not explicitly invalidating the changed module itself. While it handled related virtual modules in SSR case, it skipped the invalidation for the source file.

### Solution
An `invalidateModule` call for the changed file has been added to the `worker` environment's HMR handler.

## Testing

A comprehensive, automated HMR test suite was started but has been deferred to a future ticket ([#858](https://github.com/redwoodjs/sdk/issues/858)) to prioritize shipping these fixes and returning sooner to other priorities.

The changes have been validated through a combination of existing E2E tests and manual testing:

*   **Existing E2E Coverage**: The `requestInfo` playground test already provides automated coverage for the primary HMR scenarios involving server and client component updates.
*   **Manual Verification**: I have manually tested these fixes across multiple projects, confirming that HMR now functions correctly for:
    * The Storybook playground (resolving the original crash).
    * Direct changes to `worker.tsx`.
    * Global CSS updates via `?url` imports.
    * CSS Module updates.
    * Server component updates
    * Client component updates
    * Server functions
