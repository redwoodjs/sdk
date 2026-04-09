# Findings: Issue #1123 — `ClientNavigationOptions['onNavigate']` is Never Called

**Date**: 2026-04-09
**Issue**: https://github.com/redwoodjs/sdk/issues/1123
**Reported by**: @emanueleperuffo
**Status**: Confirmed and reproduced

---

## What Was Investigated

The claim in issue #1123: the `onNavigate` callback accepted by `initClientNavigation()` is typed in the public API and documented in two documentation pages, but is never invoked at runtime.

**Specific questions:**
1. Does `initClientNavigation()` ever call `opts.onNavigate`? (No)
2. Does the standalone `navigate()` function call it? (No — it has no access to it)
3. Can the bug be demonstrated with a failing test? (Yes)
4. What code change introduced the regression? (Commit `c543ef7`)

---

## What Was Found

### Finding 1: `onNavigate` is accepted but never invoked [Tier 1 — Source Code]

**Source**: `sdk/src/runtime/client/navigation.ts`

The function `initClientNavigation(opts: ClientNavigationOptions)` receives `opts`, which may contain `onNavigate?: () => void`. The function body does the following:

- Sets `IS_CLIENT_NAVIGATION = true`
- Registers a DOM `click` listener that calls `await navigate(href)`
- Registers a `popstate` listener that calls `globalThis.__rsc_callServer(null, null, "navigation")` directly
- Conditionally stores `opts.cacheStorage` on `globalThis`
- In `onHydrated()`, calls `onNavigationCommit` and `preloadFromLinkTags` with `opts.cacheStorage`

**`opts.onNavigate` is never referenced in any of these paths.**

The standalone `navigate()` function (lines 69–101) is entirely independent of `initClientNavigation`'s `opts` closure and has no knowledge of `onNavigate`.

### Finding 2: Empirical reproduction confirmed [Tier 1 — Test Output]

A failing test was written at:
`sdk/src/runtime/client/navigation.onNavigate.repro.test.ts`

Test procedure:
1. Called `initClientNavigation({ onNavigate: mockFn })`
2. Captured the `click` handler registered via `document.addEventListener`
3. Fired a synthetic click event pointing to `/about`
4. Asserted `mockFn` was called once

**Observed output:**
```
FAIL  ... > onNavigate callback should be called when a link click triggers navigation
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
```

The navigation completed (history push succeeded, `__rsc_callServer` was called), but `onNavigate` was never invoked. This matches the issue description exactly.

### Finding 3: Regression introduced in commit `c543ef7` [Tier 1 — Git History via GitHub API]

**Commit**: `c543ef7f425720ab1677dc7fed03965bfb37334d`
**Author**: Peter Pistorius
**Date**: 2025-10-02
**PR**: #804 — "Programmatic client side navigation"

**Before the commit**, `initClientNavigation` merged user options with defaults:

```javascript
const options: Required<ClientNavigationOptions> = {
  onNavigate: async function onNavigate() {
    await globalThis.__rsc_callServer();  // default: RSC fetch
  },
  scrollToTop: true,
  scrollBehavior: "instant",
  ...opts,  // user's onNavigate replaces default
};
```

The click handler called `await options.onNavigate()` and the `popstate` handler called `await options.onNavigate()`. The default `onNavigate` performed the RSC fetch; a user-supplied one would replace it entirely.

**After the commit**, the refactor:
- Extracted a standalone `navigate()` function
- Removed the `options` merge object entirely
- The click handler now calls `await navigate(href)` directly
- `opts.onNavigate` is **never read or called** anywhere

The commit diff confirms the removal of `await options.onNavigate()` from both the click and popstate handlers, with no replacement invocation added.

### Finding 4: Documentation and types are fully present but misleading [Tier 1 — Source Code]

The `onNavigate` option is documented in two locations:

1. `docs/src/content/docs/reference/sdk-client.mdx` (line 136): "Callback executed **after** the history entry is pushed but **before** the new RSC payload is fetched. Use it to run custom analytics or side-effects."
2. `docs/src/content/docs/guides/frontend/client-side-nav.mdx` (lines 85–97, 248): Similar description with a code example.

It also appears in the JSDoc comment for `initClientNavigation` (line 123 of `navigation.ts`): `@param opts.onNavigate - Callback executed after history push but before RSC fetch`

The TypeScript interface `ClientNavigationOptions` in both `sdk/src/runtime/client/navigation.ts` and `sdk/src/runtime/entries/types/client.ts` includes `onNavigate?: () => void`.

**None of these reflect current behavior.**

---

## Root Cause

The refactor in commit `c543ef7` (PR #804) introduced a standalone `navigate()` function and removed the `options` merge object from `initClientNavigation`. The `await options.onNavigate()` invocations in the click and popstate handlers were deleted. No equivalent call to `opts.onNavigate` was added anywhere in the refactored code. The type definition and documentation were left intact, creating a documented API with no implementation.

---

## Reproduction Artifacts

**Failing test**: `sdk/src/runtime/client/navigation.onNavigate.repro.test.ts`

Run with:
```sh
cd sdk && npx vitest run src/runtime/client/navigation.onNavigate.repro.test.ts
```

Expected failure output:
```
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
```

---

## What Remains Unclear

1. **Intended semantics after the refactor**: Before c543ef7, a user-supplied `onNavigate` replaced the default RSC-fetching behavior entirely (the user had to call `__rsc_callServer` themselves). Whether the post-refactor intent was to call `onNavigate` in addition to the RSC fetch (side-effect model) or instead of it (override model) is not specified in the issue or PR.

2. **The `navigate()` function's similar gap**: The public `navigate()` function also does not accept an `onNavigate` parameter. It is unclear whether it should.

3. **Note on a separate bug in c543ef7**: The commit introduced `await globalThis.__rsc_callServer as () => Promise<void>` (a type cast without invocation — not actually calling the function). This appears to have been subsequently fixed in the current codebase, which correctly calls `await globalThis.__rsc_callServer(null, null, "navigation")`.

---

## Evidence Index

| # | Source | Tier | Location |
|---|--------|------|----------|
| 1 | Source code: `initClientNavigation` body | 1 | `sdk/src/runtime/client/navigation.ts` lines 156–218 |
| 2 | Test output: failing assertion | 1 | `sdk/src/runtime/client/navigation.onNavigate.repro.test.ts` |
| 3 | Commit diff: removal of `options.onNavigate()` call | 1 | GitHub API — commit `c543ef7f` |
| 4 | Type definition | 1 | `sdk/src/runtime/entries/types/client.ts` line 4 |
| 5 | JSDoc comment | 1 | `sdk/src/runtime/client/navigation.ts` line 123 |
| 6 | Documentation | 1 | `docs/src/content/docs/reference/sdk-client.mdx` line 136 |
| 7 | Documentation | 1 | `docs/src/content/docs/guides/frontend/client-side-nav.mdx` lines 88, 93, 248 |
