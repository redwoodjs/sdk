# Refactor Callback Wiring Regression Pattern

**Date:** 2026-04-09
**Context:** Issue #1123 — `ClientNavigationOptions['onNavigate']` silently dropped during refactor
**Related:** `.docs/findings/2026-04-09-issue-1123-onnavigate-never-called.md`

## The Pattern

When extracting a function from inline logic, callback hooks wired through the caller's parameters can be silently dropped if:

1. The callback option is optional (e.g., `onNavigate?: () => void`) in the caller's API
2. The extracted function does not accept or propagate that callback
3. The extracted function replaces the inline logic directly

**Example from #1123:**

```ts
// Before refactor: inline, callback is invoked
document.addEventListener("click", async (event) => {
  // ... validation ...
  window.history.pushState(...);
  await options.onNavigate();  // explicitly called
  // ... scroll logic ...
});

// After refactor: extracted function, callback never called
export async function navigate(href: string, options: NavigateOptions) {
  // NavigateOptions has no onNavigate field
  window.history.pushState(...);
  await globalThis.__rsc_callServer(...);
  // ... scroll logic ...
}

document.addEventListener("click", async (event) => {
  // ... validation ...
  navigate(href);  // callback not passed or called
});
```

## Why It's Hard to Catch

1. **No compile error:** TypeScript does not warn about unused optional parameters.
2. **No runtime error:** The callback is silently ignored, not invoked with `undefined` or null.
3. **Tests may not cover the callback path:** If the original tests check behavior (e.g., "history was pushed") but not callback invocation, the regression is invisible.
4. **Documentation persists:** The JSDoc/docs continue to promise callback behavior even though it's no longer wired.
5. **Behavior appears to work:** The main functionality (navigation) still works; only the side-effect hook is lost.

## Detection Strategy

### During Code Review

- **Search for unused option fields** after refactors: `grep` or AST-based tools to find option parameters that are assigned but never read.
- **Check callback invocation sites:** If a refactored function accepts optional callbacks, verify they are actually called in all code paths.
- **Cross-check JSDoc against implementation:** If a callback is documented, search for all call sites in the function body.

### In Tests

- **Add explicit callback invocation tests** for optional hooks. Don't rely on tests that check "was the side-effect triggered?" — test that the callback itself was called.
  ```ts
  it("should call onNavigate before RSC fetch", async () => {
    const mockCallback = vi.fn();
    initClientNavigation({ onNavigate: mockCallback });
    // ... trigger navigation ...
    expect(mockCallback).toHaveBeenCalled();
  });
  ```
- **Test optional parameters explicitly:** Don't assume optional handlers "just work" because the happy path (without them) does.

### In Linting

- **Consider a custom ESLint rule** (if not already in place) to flag unused function parameters after a refactor. ESLint's `no-unused-vars` is a start, but does not catch optional-parameter silently-ignored patterns.

## Related Concepts

- **Dead code:** The `onNavigate` option type and documentation are present but unused.
- **Silent failure:** No error thrown; behavior just changes silently.
- **Extraction refactoring:** The underlying technique (extracting a function) is sound; the bug is in the wiring at the call site.

## Takeaway

When extracting functions during refactors:
1. If the caller has optional callbacks or hooks, ensure they are propagated to the extracted function or invoked in the extracted function.
2. Add tests that specifically verify optional callback invocation — don't rely on functional tests alone.
3. After refactoring, search for unused option fields and cross-check JSDoc against call sites.
