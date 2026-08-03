---
title: Client Navigation Commit Integrity
description: How RedwoodSDK guarantees that a client navigation either commits its payload to the screen or recovers, so the URL and the rendered page can never desync permanently.
---

## Problem

Client-side navigation is URL-first: `navigate()` pushes the new URL into history, then fetches the RSC payload, then commits it to the visible React tree. [Client Navigation Pending Boundaries](./clientNavigationPending.md) covers the transient version of the gap this creates — the old tree stays visible while the new payload is in flight, and apps can hide it behind Suspense fallbacks.

There is a terminal version of the same gap. In production builds under main-thread CPU starvation, a navigation can update the URL while its payload never commits at all. The page keeps rendering the previous route indefinitely; only a manual reload restores consistency. Reported in [#1245](https://github.com/redwoodjs/sdk/issues/1245) and reproduced with per-navigation lifecycle instrumentation.

The failure lives in the last step of the pipeline. Every observed failure showed the same signature: the `?__rsc` fetch completes with a 200 for the correct URL, the resolved payload is handed to React, and the commit never follows. The navigation cache was not involved (no cache hits in the failing runs), the payload stream did not error, and the stale-response guard never fired — that guard covers superseded navigations, which is not this case.

The root cause is how the payload commits. `Content` routed every navigation payload through `startTransition`:

```tsx
transportContext.setRscPayload = (v, meta) =>
  startTransition(() => {
    setStreamState({ data: v, meta });
  });
```

Transitions are interruptible. Under concurrent rendering with a starved main thread, the transition carrying a fully resolved navigation payload can be abandoned and is never retried, so React stays on the last committed payload while the address bar already shows the new route. The framework also had no way to notice this state: the pending-navigation tracker records that a commit is outstanding, but nothing acted on a commit that never arrived.

## Goals

- A navigation payload that has resolved must not be losable by the scheduler.
- If a commit still does not happen — on paths the first guarantee cannot reach, or for causes not yet known — the framework must detect it and recover without user intervention.
- Keep the URL-first navigation model: the address bar continues to update immediately on click.
- Do not change behavior for server-action payloads.

## Approach

### Non-interruptible commit for navigation payloads

`setRscPayload` now commits payloads with `source: "navigation"` via a default-priority state update instead of a transition. Default-priority renders are not abandoned the way transitions are, so a starved main thread delays the commit instead of losing it. Action payloads keep the transition path.

Validated against the regression test described below: under starvation that produced 86/120 (30% busy main thread) and 33/120 (60% busy) terminal failures on the transition path, the non-interruptible path produced 0/120 at both levels.

Deferring the URL push until after the commit ("URL-last") was considered and rejected: it changes the fetch plumbing that reads the target from `window.location`, breaks apps that read the new URL inside `onNavigate`, removes immediate address-bar feedback, and still cannot cover `popstate`, where the browser changes the URL before the framework is involved.

### Commit watchdog

The non-interruptible commit closes the loss window for link clicks and `navigate()` calls, but it cannot cover every path — browser back/forward changes the URL before the framework runs, and future loss modes are by definition unknown. The watchdog (proposed in [#1240](https://github.com/redwoodjs/sdk/issues/1240) as `navigationTimeoutMs`/`onNavigationTimeout`) is the backstop.

When a pending navigation begins, the navigation-state tracker arms a timer. A commit or abort clears it. If the timer wins, the pending navigation is aborted and recovery runs: the app's `onNavigationTimeout({ href })` handler if one is configured, otherwise a hard navigation via `window.location.assign(href)`. A hard navigation always lands on matching URL and content, so the terminal desync state becomes self-healing everywhere it can occur.

Defaults: `navigationTimeoutMs` is 10 seconds; `0` disables the watchdog. The timeout races legitimately slow navigations too — a hard navigation to the pending URL is still correct in that case, just heavier.

## Main Pieces

### `client.tsx`

`Content` inspects payload metadata in `setRscPayload`. Navigation payloads commit through a default-priority `setStreamState`; other payloads commit through `startTransition` as before.

### `navigationState.ts`

Owns the watchdog alongside the pending-navigation tracker:

- `configureNavigationTimeout({ timeoutMs, onTimeout })`: sets the watchdog duration and recovery handler.
- `beginPendingNavigation(url)`: arms the timer for the new pending navigation (replacing any previous timer).
- `commitPendingNavigation(href)` / `abortPendingNavigation(id?)`: clear the timer.
- On timeout: if the armed pending navigation is still current, it is aborted and recovery runs. A superseded navigation's timer never fires for its replacement.

### `navigation.ts`

`initClientNavigation()` accepts `navigationTimeoutMs` and `onNavigationTimeout` and forwards them to `configureNavigationTimeout`.

## Lifecycle

```text
user clicks link / app calls navigate / browser fires popstate
  -> history is updated
  -> beginPendingNavigation(targetUrl)
  -> watchdog timer armed (navigationTimeoutMs)
  -> RSC navigation request starts
  -> response returns (or cache serves it)
  -> stale-response guard discards it if the browser has moved on
  -> setRscPayload(payload, { source: "navigation", href })
  -> default-priority state update (non-interruptible)
  -> new tree commits
  -> onHydrated(meta) runs
  -> commitPendingNavigation(meta.href)
  -> watchdog timer cleared

if the commit never happens:
  -> watchdog timer fires
  -> pending navigation aborted
  -> onNavigationTimeout({ href }) or window.location.assign(href)
  -> hard navigation lands on matching URL and content
```

## Trade-offs

- Navigation renders are no longer time-sliced. A heavy navigation render blocks the main thread until it completes, so a slow device may render a navigation in one uninterrupted pass instead of yielding. This favors correctness — the commit always lands — over smoothness during the commit.
- The watchdog can fire for a navigation that is merely slow (e.g. a slow network), not stuck. Recovery is still correct — the hard navigation lands on the pending URL — but the page load is heavier than the client-side commit would have been. The 10 second default is chosen so this is rare in practice.

## Correctness Invariants

- A resolved navigation payload must not be dropped by render scheduling.
- A pending navigation resolves when it commits, is superseded, is aborted, is redirected away, or its watchdog times out.
- Watchdog recovery must always end at a URL whose content and address bar agree, which is why the default recovery is a hard navigation rather than a retry of the client-side pipeline.
- Action payload commits are unchanged and do not resolve navigation pending state.

## Regression Test

`playground/client-navigation/__tests__/nav-commit-lag.test.mts` toggles a search param via `navigate()` in a production build and asserts the committed DOM always catches up to the URL. It injects a duty-cycled busy loop into the page's main thread to starve React's commit work directly, which raises the failure rate high enough for a short test run (86/120 terminal failures on the transition path; 0/120 with the changes in this document).

## Open Follow-Ups

- [#1242](https://github.com/redwoodjs/sdk/issues/1242): request ids would distinguish rapid navigations to the exact same URL.
- [#1243](https://github.com/redwoodjs/sdk/issues/1243): aborting superseded in-flight fetches remains a resource optimization.
- Why the abandoned transition is lost rather than merely delayed is a React scheduler question left open; the framework no longer depends on the answer.
