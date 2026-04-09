# onNavigate Callback Dropped During Function Extraction Refactor

**Date:** 2026-04-09
**Issue:** #1123
**Commit that introduced regression:** `c543ef7` ("Programattic client side navigation. (#804)", 2025-10-02)

## What Happened

`initClientNavigation` originally wired `onNavigate` as the internal mechanism for both triggering the RSC fetch and providing a user callback hook (the default implementation called `__rsc_callServer`; user-provided implementations replaced the default). When `navigate()` was extracted as a standalone public function in c543ef7, the RSC fetch moved into `navigate()` directly — but neither the click handler nor the popstate handler was updated to pass `opts.onNavigate` through. The option continued to be accepted and typed, but had zero call sites in the function body.

## Why TypeScript Didn't Catch It

TypeScript does not warn about unused optional parameters. A function can accept `opts: { onNavigate?: () => void }` and simply never read `opts.onNavigate` — no compiler error, no lint warning. Structural typing means no tool surface that detects "this callback was declared but never invoked."

## Why Tests Didn't Catch It

The existing tests checked navigation behavior (redirects, error handling) but not callback invocation. Tests that validate the *side effect* of a callback (e.g., analytics were sent, a loading state was cleared) would have caught this immediately. Tests that only check what the navigation function returns miss callback regressions entirely.

## The Fix Pattern

When extracting a function that was previously responsible for calling a callback, explicitly carry the callback through via the new function's options interface. In this case:

- Added `onNavigate?: () => Promise<void> | void` to `NavigateOptions`
- Pass `opts.onNavigate` from the click handler into `navigate()` explicitly
- Handle popstate inline since it doesn't go through `navigate()`

## Lessons

1. **After any function extraction refactor, grep for the original function's parameter names** in the caller — if any option names disappear from usage, they were likely dropped.
2. **Callback options should always have a corresponding test** that asserts the callback was actually called, not just that the function completed.
3. **Optional callback parameters with `async` return values** should be typed `() => Promise<void> | void`, not `() => void`, to correctly signal that async callbacks are supported.
