# 2025-09-22: Middleware Prefix Bug

## Context

- **User Report:** Zane Shannon reported the issue, and peterp confirmed it's a bug.
- **Relevant Code:** The `prefix` function in the SDK's routing logic is the primary area of investigation.

## Problem

Middleware defined within a `prefix` block was not scoped to that prefix. It was executed for all routes, regardless of whether the request path matched the prefix. For example, in `prefix('/admin', [requireAdmin(), route('/', <AdminPage />)])`, the `requireAdmin()` middleware runs on `/` when it should only run on routes under `/admin`.

The cause was that the `prefix` utility passed middleware functions through without modification, failing to scope them to the specified path.

## Investigation

My initial approach was to reproduce the bug using a playground example. I created a new playground, set up the prefixed middleware, and wrote an e2e test. However, the test passed in the development environment, suggesting the issue might be specific to production builds.

After some consideration, I decided a playground was overkill for this kind of logic. A unit test would be more direct and efficient. I removed the playground example and added a unit test to `router.test.ts`.

The unit test failed as expected, confirming the bug. The issue was in the `prefix` function in `sdk/src/runtime/lib/router.ts`, which did not wrap middleware with a path-checking function.

## Solution

I updated the `prefix` utility to wrap middleware functions. The wrapper checks if the request's pathname starts with the specified prefix. If it does, the middleware is executed. If the path does not match, the middleware is skipped. This change correctly scopes middleware to its intended route prefix, resolving the bug.

After implementing the fix, I ran the unit test, which now passed, confirming the solution works as intended.

---

## PR Description

### Problem

Middleware defined within a `prefix` block was not scoped to that prefix. It was executed for all routes, regardless of whether the request path matched the prefix. This meant that middleware intended for a specific section of the application (e.g., `/admin`) would run on every request.

### Solution

The `prefix` utility has been updated to wrap middleware functions. This wrapper checks if the request's pathname starts with the specified prefix. If it does, the middleware is executed. If the path does not match, the middleware is skipped. This change correctly scopes middleware to its intended route prefix, resolving the bug.

### Testing

A unit test was added to `router.test.ts` to validate the fix. The test confirms two key behaviors:
1.  Prefixed middleware is only executed for requests to paths that match the prefix.
2.  Prefixed middleware is skipped for requests that do not match the prefix.

The test also verifies that middleware can still short-circuit the request by returning a `Response`, even when wrapped by the `prefix` utility.
