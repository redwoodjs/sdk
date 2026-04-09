# Learning: Callback Extraction and Closure Loss

**Date**: 2026-04-09
**Context**: Issue #1123 investigation
**Category**: Refactoring patterns
**Severity**: Medium

---

## The Pattern

When refactoring a function to extract reusable logic into a standalone function, developers often extract the "business logic" but forget that the original function may have been invoking options/callbacks from its closure. The extracted function cannot access these callbacks unless they are explicitly passed as parameters.

This is easy to miss because:
1. The extracted function may compile and run without the parameter.
2. The original function signature remains unchanged (the options are still accepted).
3. Tests may pass if they don't exercise the callback path.

---

## Real-world example: PR #804 (commit `c543ef7`)

**Before**: `initClientNavigation` built an options object with defaults and called `await options.onNavigate()` in both the click handler and the popstate handler.

```js
const options: Required<ClientNavigationOptions> = {
  onNavigate: async function onNavigate() {
    await globalThis.__rsc_callServer();  // default implementation
  },
  scrollToTop: true,
  scrollBehavior: "instant",
  ...opts,  // user's overrides, may include user's onNavigate
};

// Click handler:
event.preventDefault();
await options.onNavigate();  // CALLBACK INVOKED

// Popstate handler:
await options.onNavigate();  // CALLBACK INVOKED
```

**After**: Navigation logic was extracted into a standalone `navigate()` function. The `options` object was removed. Both `await options.onNavigate()` call sites were deleted.

```js
export async function navigate(href: string, options: NavigateOptions = {}) {
  // ... navigation logic ...
  // NO onNavigate parameter. NO onNavigate invocation.
}

export function initClientNavigation(opts: ClientNavigationOptions = {}) {
  // Click handler:
  event.preventDefault();
  await navigate(href);  // navigate() doesn't know about opts.onNavigate

  // Popstate handler:
  await globalThis.__rsc_callServer(...);  // Direct call, no opts.onNavigate
}
```

The problem: `opts.onNavigate` is still accepted by `initClientNavigation`, but it's never used. The refactor deleted the invocation without forwarding the callback to the new `navigate()` function.

---

## Why it matters

1. **Silent behavior change**: The function signature doesn't change, so callers don't realize their callback is no longer invoked.
2. **Testing gap**: If tests don't explicitly verify that callbacks are invoked, the regression goes undetected.
3. **Breaking change without a break**: TypeScript won't complain; the code compiles and runs.

---

## Detection and Prevention

### At-Review Time

When extracting a function:
- **Inventory all closures**: What variables from the outer scope does the logic depend on? (Including callbacks, options, side-effects.)
- **Decide: pass or drop?** For each closure variable:
  - If it's needed, add it as a parameter to the extracted function.
  - If it's being dropped, update the caller to handle it (don't silently ignore it).
- **Check call sites**: For each place the extracted function is called, verify that all closures it needs are provided.

### Automated

- **Linting rule**: A hypothetical rule could flag: *"Function accepts an options parameter with a callback, but never uses it"* — though this has false positives (options can be forwarded to other functions).
- **Test coverage for options**: Every option parameter should have a test that exercises it. If a test for `onNavigate` exists and passes, the extraction would fail the test and catch the regression.

---

## Takeaway

When extracting a function from an options-accepting wrapper:

1. **List all options the original function accepts and uses.**
2. **For each option, decide: is the extracted function responsible for handling it, or is the wrapper responsible?**
3. **Make the data flow explicit**: pass it as a parameter, or document in a comment why it's being dropped.
4. **Update or add tests for each option** — especially callbacks and side-effects.

In this codebase, a test exercising `onNavigate` would have caught the regression immediately during the code review of PR #804.
