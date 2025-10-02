# Client-side reference error investigation

## Problem
A `ReferenceError: __webpack_require__ is not defined` error is happening in one project after updating to a post-alpha.20 build of the SDK. This global is expected to be set by `sdk/src/runtime/client/setWebpackRequire.ts`.

## Plan
1.  Identify changes to client-side entry point files since `alpha.20`.
2.  Analyze these changes to find the cause of the issue.
3.  Propose a fix.

## Context
- Last working version: `alpha.20`
- The error seems to be caused by `__webpack_require__` not being defined when `react-server-dom-webpack` client code runs.
- The issue is project-specific, which may indicate a subtle configuration or timing-related problem.

## Investigation

- Reviewed git history for `sdk/src/runtime/client/` between `v1.0.0-alpha.20` and `HEAD`.
- Commits `a5b5ed20` and `c543ef7f` show changes related to project structure and programmatic navigation.
- No direct changes to `setWebpackRequire.ts` or its import were found.
- The user's project uses a dynamic import (`<script>import("/src/client.tsx")</script>`) in `Document.tsx`, which is an important constraint.
- The issue is likely related to changes in the build process or dependencies, not the client-side code itself.

## Investigation - Part 2 (The Red Herring)

- It was discovered that the 404 error was a red herring caused by an incorrect local testing setup (dev server vs. preview server).
- The original error, `Uncaught (in promise) ReferenceError: __webpack_require__ is not defined`, is indeed the real issue.
- The issue is confirmed to appear between `v1.0.0-alpha.20` (working) and later beta versions.

## Attempts to Fix (Failed)

Based on the strong evidence that an import ordering issue was introduced in commit `a5b5ed20`, several attempts were made to isolate the problematic file. All of these have failed, proving the issue is more complex than a simple change in a single file.

1.  **Reverting `sdk/src/runtime/client/client.tsx`:** Manually reverting the import order in this file and protecting it with `prettier-ignore` did not solve the issue.
2.  **Reverting `sdk/src/runtime/entries/client.ts`:** Reverting this client entrypoint file to its `alpha.20` state also did not solve the issue.
3.  **Reverting other `sdk/src/runtime` directories:** A process of elimination, reverting directories like `runtime/client`, `runtime/entries`, and `runtime/imports`, did not isolate a single source for the bug.

## Current Status

- **Confirmed:** Reverting the entire `sdk/src` directory to the commit *before* `a5b5ed20` **does** fix the issue.
- **Confirmed:** Reverting individual files or subdirectories within `sdk/src` has so far **not** fixed the issue.
- **Conclusion:** The breaking change is a result of a complex interaction between multiple files changed in `a5b5ed20`, likely triggered by a subtle dependency update or build tool behavior change.

We are back to the drawing board, using a process of elimination on the `a5b5ed20` commit to find the true root cause.

## SOLVED: Root Cause in `realtime/client.ts`

The process of elimination successfully isolated the breaking change to `sdk/src/runtime/lib/realtime/client.ts`.

In commit `a5b5ed20` (part of PR #795), a code reformatting pass altered the import order in this file. Specifically, `react-server-dom-webpack/client.browser` began to be imported *before* `../../client/client.tsx`.

The main client entrypoint, `client.tsx`, is responsible for running the critical side-effect import of `setWebpackRequire.ts`, which defines the `globalThis.__webpack_require__` global that `react-server-dom-webpack` depends on.

By reordering the imports, the bundler would attempt to evaluate `react-server-dom-webpack` before the side-effect from `setWebpackRequire` had a chance to run, causing the `ReferenceError`.

This explains why the issue was specific to the user's project: it was one of the few using the `initRealtimeClient` function, making it sensitive to this particular import path.

The solution is to add a direct, side-effect-only import of `../../client/setWebpackRequire` to the very top of `sdk/src/runtime/lib/realtime/client.ts`, ensuring the global is defined before any other modules are evaluated.

This change fixes a client-side reference error (`__webpack_require__ is not defined`) that occurred in projects using the `initRealtimeClient` function.

#### Problem

In commit `a5b5ed20` (part of PR #795), a code reformatting pass with Prettier altered the import order in `sdk/src/runtime/lib/realtime/client.ts`. The import for `react-server-dom-webpack/client.browser` was moved to execute before the import for `../../client/client.tsx`.

The `client.tsx` module contains a critical side-effect import for `setWebpackRequire.ts`, which defines the `__webpack_require__` global. The `react-server-dom-webpack` library depends on this global being present at the time its module is first evaluated.

The reordering caused the bundler to evaluate `react-server-dom-webpack` before the side-effect had run, leading to a `ReferenceError`. This issue was specific to the real-time client's entry path and did not affect projects using the standard `initClient`.

#### Solution

This change adds a direct, side-effect-only import for `setWebpackRequire` to the top of `sdk/src/runtime/lib/realtime/client.ts`. This mirrors the pattern used in the main `client.tsx` entrypoint and guarantees that the `__webpack_require__` global is defined before any module that depends on it is evaluated, resolving the error.