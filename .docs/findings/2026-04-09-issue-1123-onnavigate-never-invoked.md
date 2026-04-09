# Findings Report: Issue #1123 — `onNavigate` Callback is Never Invoked

**Date**: 2026-04-09
**Issue**: https://github.com/redwoodjs/sdk/issues/1123
**Reporter**: @emanueleperuffo
**Reviewed by**: TechLead (phase 2 — PASS)
**Status**: Confirmed and reproduced

---

## 1. Issue Summary

The `onNavigate` option in `ClientNavigationOptions` is exposed in the public TypeScript type, documented in the official reference docs and the client-side navigation guide, and described in JSDoc comments with a usage example. Its documented contract is: *"Callback executed after the history entry is pushed but before the new RSC payload is fetched. Use it to run custom analytics or side-effects."*

**Expected behavior**: When a user passes `onNavigate: () => void` to `initClientNavigation()`, that function is called on each navigation event (link click or browser back/forward).

**Actual behavior**: The callback is accepted as a parameter and silently ignored. No navigation event ever calls it.

---

## 2. Reproduction

### Prerequisites

No server, browser, or build step required. The reproduction runs entirely as a unit test against the SDK source.

### Steps

1. Checkout the repo (tested on `kindling/2026-04-09-2135-reproduce-issue-1123-eaaf`, commit `a2e603c`)
2. Run the reproduction test:

```sh
cd sdk
npx vitest run src/runtime/client/navigation.onNavigate.repro.test.ts
```

### Observed Output

```
 RUN  v4.1.2 /home/vscode/repo/sdk

 ❯ src/runtime/client/navigation.onNavigate.repro.test.ts (2 tests | 1 failed) 4ms
     × onNavigate callback should be called when a link click triggers navigation 3ms

 FAIL  ... > onNavigate callback should be called when a link click triggers navigation
AssertionError: expected "vi.fn()" to be called 1 times, but got 0 times
 ❯ src/runtime/client/navigation.onNavigate.repro.test.ts:111:28
```

### What the test does

1. Calls `initClientNavigation({ onNavigate: mockFn })` using the documented API
2. Captures the click event handler registered via `document.addEventListener`
3. Fires a synthetic left-button click pointing to `/about` — all `validateClickEvent` guards pass
4. Asserts the callback was called once

The navigation itself completes: `history.pushState` is called, `globalThis.__rsc_callServer` is called. The mock callback receives zero invocations. This matches the issue description exactly.

*This test was independently confirmed by the TechLead in phase 2.*

---

## 3. Root Cause

### Regression commit: `c543ef7` (PR #804)

**Commit hash**: `c543ef7f425720ab1677dc7fed03965bfb37334d`
**Author**: Peter Pistorius
**Date**: 2025-10-02
**PR title**: "Programattic client side navigation. (#804)"

*(Source: GitHub API — `GET /repos/redwoodjs/sdk/commits/c543ef7`)*

### What the code looked like before the commit

`initClientNavigation` merged caller options with defaults using an explicit `Required<ClientNavigationOptions>` object:

```js
const options: Required<ClientNavigationOptions> = {
  onNavigate: async function onNavigate() {
    await globalThis.__rsc_callServer();   // default: perform the RSC fetch
  },
  scrollToTop: true,
  scrollBehavior: "instant",
  ...opts,                                 // user's onNavigate replaces default
};
```

Both the click handler and the popstate handler ended with `await options.onNavigate()`. The RSC fetch lived *inside* the default `onNavigate`, so a user-supplied callback replaced the entire fetch step (override model — discussed further in §4).

### What the commit changed

PR #804 refactored the click-driven navigation into a standalone exported `navigate()` function. The `options` merge object was removed entirely. Both `await options.onNavigate()` call sites were deleted with no replacement.

The resulting `initClientNavigation` body:

```js
export function initClientNavigation(opts: ClientNavigationOptions = {}) {
  IS_CLIENT_NAVIGATION = true;
  // ...click handler calls: await navigate(href)
  // ...popstate handler calls: await globalThis.__rsc_callServer(null, null, "navigation")
  // opts.onNavigate is never read or called anywhere
}
```

*(Source: `sdk/src/runtime/client/navigation.ts`, lines 156–218)*

The `onNavigate` field was left in the `ClientNavigationOptions` interface, in the JSDoc comment, and in both documentation pages, but has no runtime implementation.

### Why the `navigate()` function cannot call `onNavigate`

The standalone `navigate(href, options)` function has its own `NavigateOptions` type, which does not include `onNavigate`. Even if a caller wanted to pass the callback through, there is currently no parameter slot for it. The `opts` closure from `initClientNavigation` is not accessible inside `navigate()`.

*(Source: `sdk/src/runtime/client/navigation.ts`, lines 61–101)*

---

## 4. Open Design Question

### Pre-refactor: override model

Before c543ef7, the default `onNavigate` *was* the RSC fetch. A user who supplied their own `onNavigate` completely replaced the fetch step — they were responsible for calling `__rsc_callServer` themselves if they wanted navigation to work at all. This is an override model, similar to a middleware pattern.

### Post-refactor: what the model should be

After the refactor, the RSC fetch is called unconditionally (it is not guarded by any user-supplied hook). The natural post-refactor model would be a **side-effect model**: `onNavigate` fires alongside the RSC fetch (either before, after, or in a defined order) as a non-exclusive observer.

The documentation describes the callback as executing *"after the history entry is pushed but before the new RSC payload is fetched"* — which implies a pre-fetch side-effect model. Whether the correct fix should implement that ordering, or simply call `onNavigate` after the fetch (post-navigation callback), is a product decision not determined by the investigation.

**This question is out of scope for this investigation and must be resolved before any fix is implemented.**

---

## 5. Known Gaps

### `popstate` path not empirically tested

The `popstate` handler in `initClientNavigation` also never calls `opts.onNavigate`:

```js
window.addEventListener("popstate", async function handlePopState() {
  await globalThis.__rsc_callServer(null, null, "navigation");
});
```

This was identified through source code inspection (Tier 1) but was not covered by the reproduction test. A test for this path would require capturing the `window.addEventListener` mock's registered handler and invoking it, analogous to the click test. The omission does not affect the validity of the primary reproduction — the click path is the primary user-facing trigger and is fully tested.

**Claim classification**: The assertion that `onNavigate` is never called on back/forward navigation is **unverified empirically** (code inspection only).

---

## 6. Evidence Index

| # | Artifact | Type | Tier | Location |
|---|----------|------|------|----------|
| E1 | Reproduction test | Failing unit test | 1 | `sdk/src/runtime/client/navigation.onNavigate.repro.test.ts` |
| E2 | Test failure output | Observed command output | 1 | Captured in §2 above; independently confirmed by TechLead |
| E3 | `initClientNavigation` body — no `onNavigate` call | Source code | 1 | `sdk/src/runtime/client/navigation.ts` lines 156–218 |
| E4 | `navigate()` function — no `onNavigate` parameter | Source code | 1 | `sdk/src/runtime/client/navigation.ts` lines 61–101 |
| E5 | `ClientNavigationOptions` type definition | Source code | 1 | `sdk/src/runtime/client/navigation.ts` line 11; `sdk/src/runtime/entries/types/client.ts` line 4 |
| E6 | JSDoc comment describing `onNavigate` | Source code | 1 | `sdk/src/runtime/client/navigation.ts` line 123 |
| E7 | Documentation — reference page | Docs | 1 | `docs/src/content/docs/reference/sdk-client.mdx` line 136 |
| E8 | Documentation — guide page | Docs | 1 | `docs/src/content/docs/guides/frontend/client-side-nav.mdx` lines 88, 93, 248 |
| E9 | Commit diff showing removal of `options.onNavigate()` calls | Git history (via GitHub API) | 1 | Commit `c543ef7f` — `sdk/src/runtime/client/navigation.ts` patch |
| E10 | `popstate` handler — no `onNavigate` call | Source code (unverified empirically) | 1 | `sdk/src/runtime/client/navigation.ts` lines 178–180 |
