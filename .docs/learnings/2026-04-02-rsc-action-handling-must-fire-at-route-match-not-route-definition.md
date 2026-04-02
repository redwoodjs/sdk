# RSC action handling must fire at route-match time, not route-definition-encounter time

**Date**: 2026-04-02
**Issue**: #1110 — RSC server action interruptors execute before global middleware completes

## What happened

The request processing loop iterates over a flattened route table that interleaves middleware entries and route definitions. The intent is that all global middleware (entries before the first page route) runs first, and only then does RSC action handling fire — ensuring interruptors see a fully-prepared request context (auth, session, etc.).

The bug: action handling was triggered the moment the loop encountered the *first route definition*, regardless of whether that definition matched the current request or whether global middleware entries after it had run. In practice, if any route definition appeared before a global middleware in the flattened list (e.g. an API route defined before a session-setup middleware), interruptors would run before the middleware.

## The fix

Move `handleAction()` to fire only after a route is confirmed as a match — after both path matching and HTTP method validation succeed. At that point, every preceding entry in the loop (including all global middleware) has already run. The "no route matched" fallback path uses the existing `actionHandled` flag to avoid double-invocation.

## The lesson

**In a single-pass loop over a mixed middleware/route table, "first definition encountered" ≠ "all prior middleware has run."**

If a trigger needs to fire *after all global middleware*, the correct guard is not "have we seen the first route definition?" but rather "are we about to execute a confirmed match?" A route definition may appear anywhere in the table relative to global middleware; only a confirmed match guarantees that every preceding entry has been processed.

This distinction matters for any logic that depends on context state set by global middleware (auth tokens, session data, feature flags). Fire it too early and the context is partial; interruptors that check `ctx.user` will see `undefined`.

## Sibling hazard

Any future feature that needs to run "after global middleware, before route handlers" should anchor on route-match confirmation, not first-definition-encounter. Searching for `firstRouteDefinitionEncountered` or similar patterns is a signal to review for this hazard.
