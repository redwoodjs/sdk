# 2025-09-22: Middleware Prefix Bug

## Problem

Middleware interrupters are running outside of their matched prefix. For example, in `prefix('/admin', [requireAdmin(), route('/', <AdminPage />)])`, the `requireAdmin()` middleware runs on `/` when it should only run on routes under `/admin`.

This was caused by the `prefix` utility not properly scoping middleware functions. It would pass them through without any modification, causing them to run for all routes.

## Solution

The `prefix` utility was updated to wrap middleware functions. The wrapper checks if the request's pathname starts with the specified prefix. If it does, the middleware is executed. Otherwise, it's skipped.

This ensures that middleware is correctly scoped to its prefix, preventing unintended execution on other routes.

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

## Plan

1.  ~~Create a new playground example to reproduce the bug.~~
2.  ~~Write a failing test case that demonstrates the bug.~~
3.  Write a unit test to verify the fix.
4.  Investigate the cause of the bug in the SDK's routing and middleware logic.
5.  Implement a fix to correctly scope middleware to its prefix.
6.  Verify the fix by running the tests.
7.  Clean up and finalize the playground example.

## Context

- **User Report:** Zane Shannon reported the issue, and peterp confirmed it's a bug.
- **Relevant Code:** The `prefix` function in the SDK's routing logic is the primary area of investigation.
