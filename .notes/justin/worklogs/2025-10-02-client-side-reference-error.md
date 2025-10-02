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
