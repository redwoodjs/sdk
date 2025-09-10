# RSC Actions in Middleware

## Problem

React Server Component (RSC) action handlers currently bypass the middleware pipeline. This means that common logic, such as setting security headers via a dedicated middleware, is not applied to the responses of these action requests. This creates an inconsistency in request handling and a potential security gap.

## Goal

Ensure that RSC action requests are processed by the same middleware pipeline as regular page requests before the action handler is invoked. This will guarantee consistent application of middleware logic across the board.

## Plan

The solution integrates the action handling logic directly into the router's request-handling process. This ensures it executes after all user-defined middleware.

1.  **Add `actionResult` to `RwContext`**: The `RwContext` type is updated to include an optional `actionResult` property to carry the result of a server action.
2.  **Refactor the Router's `handle` Method**: The `handle` method in `sdk/src/runtime/lib/router.ts` is modified to:
    *   Accept the `rscActionHandler` function as an argument.
    *   First, iterate through and execute all global middleware.
    *   After the middleware has run, check if the request is for an RSC action. If so, execute the `rscActionHandler` and store its result in `rw.actionResult`.
    *   Finally, proceed with route matching for page components.
3.  **Update `worker.tsx`**: The call to `router.handle` in `sdk/src/runtime/worker.tsx` is updated to pass the `rscActionHandler` function.

## Addendum: Improving the Middleware API for the Breaking Change

Because this change is a breaking one, developers need a clean way to prevent their existing middleware from running against action requests. Forcing them to inspect the URL to detect and bypass actions was considered a poor developer experience. To provide a clear and robust API for this migration path, a new `isAction` boolean property was added to the `RequestInfo` object. This flag is set in `worker.tsx` during initial request processing, making it simple for any middleware to conditionally apply its logic.
