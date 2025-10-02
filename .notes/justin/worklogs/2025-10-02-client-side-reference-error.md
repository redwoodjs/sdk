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

## Next Steps

- Investigate changes in `sdk/src/vite/` and dependencies between `v1.0.0-alpha.20` and `v1.0.0-beta.0`.
