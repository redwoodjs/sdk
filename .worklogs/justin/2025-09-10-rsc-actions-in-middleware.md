# RSC Actions in Middleware

## Problem

React Server Component (RSC) action handlers currently bypass the middleware pipeline. This means that common logic, such as setting security headers via a dedicated middleware, is not applied to the responses of these action requests. This creates an inconsistency in request handling and a potential security gap.

## Goal

Ensure that RSC action requests are processed by the same middleware pipeline as regular page requests before the action handler is invoked. This will guarantee consistent application of middleware logic across the board.

## Plan

The proposed solution involves integrating the action-handling logic directly into the middleware flow.

1.  **Introduce an `actionResult` to `RwContext`**: Add an optional `actionResult` property to the `RwContext` type. This will allow us to pass the result of a server action from our action-handling middleware to the rendering logic.
2.  **Create a dedicated Action-Handling Middleware**: In `sdk/src/runtime/worker.tsx`, we will define a new middleware. This middleware will be responsible for:
    *   Detecting if an incoming request is an RSC action.
    *   If it is, calling the `rscActionHandler` to execute the server action.
    *   Storing the result of the action in `requestInfo.rw.actionResult`.
3.  **Inject the Middleware**: Prepend this action-handling middleware to the user's list of routes and middleware. This ensures it runs after all user-defined middleware but before any page route is matched.
4.  **Refactor Rendering Logic**: Modify the `renderPage` function in `sdk/src/runtime/worker.tsx` to read the `actionResult` from the context instead of calling `rscActionHandler` directly. This decouples the rendering logic from the action execution.

## Revised Plan

The initial approach of prepending a dedicated middleware was rejected because it did not correctly handle arbitrary user-defined middleware. The action handler middleware would always run first, which could break middleware that needs to execute before the action, such as authentication.

The new plan is to integrate the action handling logic directly into the router's request-handling process.

1.  **Add `actionResult` to `RwContext`**: The `RwContext` type will be updated to include an optional `actionResult` property to carry the result of a server action.
2.  **Refactor the Router's `handle` Method**: The `handle` method in `sdk/src/runtime/lib/router.ts` will be modified to:
    *   Accept the `rscActionHandler` function as an argument.
    *   First, iterate through and execute all global middleware.
    *   After the middleware has run, check if the request is for an RSC action. If so, execute the `rscActionHandler` and store its result in `rw.actionResult`.
    *   Finally, proceed with route matching for page components.
3.  **Update `worker.tsx`**: The call to `router.handle` in `sdk/src/runtime/worker.tsx` will be updated to pass the `rscActionHandler` function.
