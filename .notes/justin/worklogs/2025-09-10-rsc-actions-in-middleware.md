# Work Log: 2025-09-10 - Integrating RSC Actions into the Middleware Pipeline

## 1. Problem Definition

React Server Component (RSC) action handlers were found to be bypassing the entire middleware pipeline. This meant that critical, cross-cutting logic, such as authentication checks or the injection of security headers, was not being applied to action requests. This created a significant inconsistency in request handling and a potential security vulnerability, as action endpoints would not be protected by the same safeguards as regular page renders.

The goal was to ensure all requests, including RSC actions, are processed through the same middleware pipeline to guarantee consistent application of logic.

## 2. Investigation: Finding the Right Integration Point

The central challenge was to find the correct place to hook RSC action handling into the existing request lifecycle without duplicating logic or creating an awkward API.

### Attempt #1: A Dedicated Action Middleware (Discarded)

The first idea was to create a special middleware that would be responsible for identifying and executing RSC actions. This middleware would be added to the user's route definitions.

This was quickly discarded. It would require developers to remember to add this special middleware, and its position in the chain would be ambiguous. More importantly, it felt like a workaround rather than a fundamental integration. Actions are a core part of the request model, not an optional feature to be bolted on.

### Attempt #2: Wrapping the Handler in `worker.tsx` (Discarded)

Another approach considered was to manually run the middleware pipeline inside `worker.tsx` right before calling `rscActionHandler`. This would involve importing the user's defined routes, extracting the middleware, and executing them against the request.

This was also rejected. It would mean duplicating the middleware-running logic that already exists within the router. This would be a clear violation of DRY principles and would be brittle, as any future changes to the router's middleware handling would need to be replicated in `worker.tsx`.

## 3. The Solution: Integrating Actions into the Router Lifecycle

The investigation led to the realization that the router itself is the single source of truth for the middleware pipeline. The most robust and correct solution was to make the router responsible for handling actions as a distinct step in its lifecycle, right alongside page rendering.

This led to the final implementation:

1.  **Modify the Router's `handle` Method:** The `handle` method in `sdk/src/runtime/lib/router.ts` was refactored. It now accepts the `rscActionHandler` as an argument. Its internal logic was re-ordered to first execute all global middlewares. Only after the middleware pipeline has completed does it check if the incoming request is an RSC action.
2.  **Execute and Store Action Results:** If the request is identified as an action, the `rscActionHandler` is invoked, and its result is stored in a new `rw.actionResult` property on the `RwContext`. This makes the action's outcome available to subsequent rendering logic.
3.  **Update `worker.tsx`:** The call to `router.handle` in `sdk/src/runtime/worker.tsx` was updated to pass the `rscActionHandler`, completing the integration.

This approach ensures that action handling is a first-class citizen of the request lifecycle, downstream of all middleware, just like a page route.

## 4. A Refinement for Developer Experience

Integrating actions into the pipeline created a new, predictable problem: what if a developer *doesn't* want a specific middleware to run for action requests? Forcing them to inspect the URL (e.g., checking for `__rsc_action_id`) inside every middleware was considered a poor developer experience and a leaky abstraction.

To address this, the solution was refined to provide a clean, explicit API. A new boolean property, `isAction`, was added to the `RequestInfo` object. This flag is set to `true` in `worker.tsx` for any action request, allowing developers to easily and robustly opt-out of middleware logic with a simple conditional check:

```typescript
// Example middleware
const myMiddleware = (requestInfo) => {
  if (requestInfo.isAction) {
    return; // Do not run for actions
  }
  // ... middleware logic ...
}
```

This refinement provides a clear migration path and a robust API for the breaking change, improving the overall developer experience.
