# Findings Report: Issue #1123 — `ClientNavigationOptions['onNavigate']` is Never Called

**Date:** 2026-04-09
**Reporter:** Emanuele Peruffo (@emanueleperuffo)
**Investigated by:** Analyst (kindling task force)
**Evidence reviewed by:** TechLead (kindling task force, phase 2)
**Status:** Reproduced. Root cause identified.

---

## Issue Summary

**Reported behavior:** The `onNavigate` callback passed to `initClientNavigation()` is never invoked under any navigation scenario.

**Expected behavior:** Per documentation, `onNavigate` should be called after the browser history entry is pushed but before the new RSC (React Server Components) payload is fetched. It is intended for analytics, side-effects, and custom hooks on navigation events.

**Reporter's observation:** Searching the codebase, `onNavigate` appears only in the type definition and documentation — it has no call sites in the implementation. The reporter identified commit `c543ef7` as the likely point of regression ("I saw that commit c543ef7 removed the `await`").

**Maintainer acknowledgment:** A core maintainer responded on the issue: "Thanks, taking a look now."

---

## Reproduction

### Method

Two failing unit tests were written that simulate actual user code. Each test:

1. Calls `initClientNavigation({ onNavigate: mockFn })` exactly as a user would
2. Captures the event listeners actually registered by the function
3. Fires a realistic event (click or popstate) that should trigger navigation
4. Asserts that `mockFn` was called — which it is not

Both click-based navigation and popstate (browser back/forward) navigation were tested independently.

### Test Output (Tier 1 — empirical)

```
FAIL  src/runtime/client/navigation.test.ts > onNavigate callback (issue #1123 reproduction) > REPRODUCES ISSUE #1123: onNavigate is NOT called during link click navigation
AssertionError: expected "vi.fn()" to be called at least once
 ❯ src/runtime/client/navigation.test.ts:186:24

FAIL  src/runtime/client/navigation.test.ts > onNavigate callback (issue #1123 reproduction) > REPRODUCES ISSUE #1123: onNavigate is NOT called during popstate navigation
AssertionError: expected "vi.fn()" to be called at least once
 ❯ src/runtime/client/navigation.test.ts:201:24

Tests  2 failed | 481 passed (483)
```

This output was independently reproduced by the TechLead during the phase 2 evidence review.

### Minimal Reproduction Steps

```ts
import { initClientNavigation } from "rwsdk/client";

const onNavigate = () => console.log("navigating");

// This sets up the handler — onNavigate is accepted without error
initClientNavigation({ onNavigate });

// Navigate to any internal link. onNavigate is never logged.
```

---

## Root Cause

### What broke

The `onNavigate` callback is accepted by `initClientNavigation()` via the `ClientNavigationOptions` type, stored in the `opts` parameter, but **never read or invoked in the function body**. Both navigation code paths bypass it entirely.

### Evidence (source tracing — unverified in isolation, cross-validated by test output)

**Call site audit (Tier 3 — source code tracing):**

Searching all references to `opts.` inside `initClientNavigation` in `sdk/src/runtime/client/navigation.ts`:

```
line 201: opts.cacheStorage
line 202: opts.cacheStorage
line 209: opts.cacheStorage
line 210: opts.cacheStorage
```

`opts.onNavigate` appears zero times after the type declaration (line 11) and the JSDoc comment (line 123). This source-tracing finding is corroborated by the Tier 1 test evidence above — the mock was never called even when the actual event handlers fired.

**Click navigation path (Tier 3 — source code tracing):**

The click handler inside `initClientNavigation` (line 173) calls:

```ts
await navigate(href);
```

The standalone `navigate()` function accepts `NavigateOptions`, which does not include `onNavigate`. Inside `navigate()`, the RSC fetch is triggered directly:

```ts
await globalThis.__rsc_callServer(null, null, "navigation");
```

There is no mechanism by which `opts.onNavigate` from `initClientNavigation` reaches `navigate()`. The option is silently dropped at the call boundary.

**Popstate path (Tier 3 — source code tracing):**

The popstate handler (lines 178–180) also bypasses `onNavigate`:

```ts
window.addEventListener("popstate", async function handlePopState() {
  await globalThis.__rsc_callServer(null, null, "navigation");
});
```

No reference to `opts.onNavigate` here either. Both navigation paths call the RSC server directly.

### When it broke — commit c543ef7 (Tier 2 — GitHub API commit data)

The GitHub API for commit `c543ef7f` (Peter Pistorius, 2025-10-02, "Programmatic client side navigation, #804") provides the before/after diff for `sdk/src/runtime/client/navigation.ts`.

**Before c543ef7**, `initClientNavigation` merged the user's `onNavigate` with a default RSC fetch callback, and called it explicitly from both navigation paths:

```ts
// Before the refactor:
const options: Required<ClientNavigationOptions> = {
  onNavigate: async function onNavigate() {
    await globalThis.__rsc_callServer();  // default implementation
  },
  scrollToTop: true,
  scrollBehavior: "instant",
  ...opts,  // user's onNavigate overrides the default here
};

// In the click handler:
await options.onNavigate();

// In the popstate handler:
await options.onNavigate();
```

In this design, `onNavigate` served dual purpose: it was the internal trigger for the RSC fetch AND the user's hook. The default implementation called `__rsc_callServer`; a user-supplied callback replaced the default entirely.

**After c543ef7**, a standalone `navigate()` function was extracted as a public export. The RSC fetch was moved directly into `navigate()`. However, the `opts.onNavigate` wiring was not preserved — neither the click handler nor the popstate handler was updated to call it.

This is corroborated by the issue reporter independently identifying the same commit as the regression point.

**Limitation:** The local repository is a shallow clone with only 4 commits; `c543ef7` cannot be checked out directly to verify pre-regression behavior at runtime. The GitHub API diff and the issue reporter's independent identification are the available evidence.

### Summary of root cause

The refactor in c543ef7 that introduced the standalone `navigate()` function decoupled the RSC fetch from the user callback hook. Before the refactor, `onNavigate` was the mechanism for triggering the RSC fetch, so it was always called. After the refactor, the RSC fetch lives in `navigate()` directly, and no code path calls the user's `onNavigate` callback. The option became dead code.

---

## Open Questions

### 1. Should `onNavigate` fire when `navigate()` is called programmatically?

The original `onNavigate` was only wired through `initClientNavigation`'s internal handlers. The new `navigate()` is a public export that can be called directly by user code — bypassing `initClientNavigation` entirely. It is not currently specified whether `onNavigate` should fire in that case. This is a design question for the maintainer.

### 2. Type mismatch between implementation and documentation (Tier 3 — source code tracing)

The type definition (`navigation.ts:11`) declares `onNavigate?: () => void`.

The reference documentation (`sdk-client.mdx:136`) declares `() => Promise<void> | void` and shows async usage examples:

```ts
onNavigate: async () => {
  await myAnalytics.track(window.location.pathname);
},
```

Whether the type should be updated to allow async callbacks, or whether async callbacks are already safe due to JavaScript's fire-and-forget behavior for `void` return types, is unspecified. This is a secondary issue but should be clarified when fixing the primary bug.

---

## Reproduction Artifacts

**Branch:** `kindling/2026-04-09-2154-reproduce-issue-1123-72b4`

**Committed test file:** `sdk/src/runtime/client/navigation.test.ts`

The two failing tests are in the `"onNavigate callback (issue #1123 reproduction)"` describe block. Running the navigation test suite will show both failures immediately.

---

## Evidence Index

| # | Claim | Tier | Source | Location |
|---|-------|------|--------|----------|
| 1 | `onNavigate` is never called during link click navigation | **Tier 1** (empirical) | Test execution output | `navigation.test.ts:186`, test runner output |
| 2 | `onNavigate` is never called during popstate navigation | **Tier 1** (empirical) | Test execution output | `navigation.test.ts:201`, test runner output |
| 3 | `opts.onNavigate` has zero call sites in `initClientNavigation` body | **Tier 3** (source tracing) | Source code | `sdk/src/runtime/client/navigation.ts`, entire function body |
| 4 | Click handler calls `navigate()` which has no `onNavigate` parameter | **Tier 3** (source tracing) | Source code | `navigation.ts:173`, `navigation.ts:69` |
| 5 | Popstate handler calls `__rsc_callServer` directly, bypassing `onNavigate` | **Tier 3** (source tracing) | Source code | `navigation.ts:178–180` |
| 6 | Before c543ef7, `onNavigate` was called from both handlers | **Tier 2** (documentary) | GitHub API commit diff | `gh api repos/redwoodjs/sdk/commits/c543ef7`, `navigation.ts` patch |
| 7 | c543ef7 introduced standalone `navigate()` and dropped the `onNavigate` wiring | **Tier 2** (documentary) | GitHub API commit data | Commit `c543ef7f`, 2025-10-02, Peter Pistorius |
| 8 | Type definition declares `() => void`, docs declare `() => Promise<void> \| void` | **Tier 3** (source tracing) | Source code + docs | `navigation.ts:11`, `sdk-client.mdx:136` |
| 9 | Issue reporter independently identified c543ef7 as the regression point | **Tier 3** (community — GitHub issue) | GitHub issue #1123 | Comment by @emanueleperuffo |
