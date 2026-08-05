---
title: Client Navigation Commit Integrity
description: How RedwoodSDK keeps the browser URL and the rendered page in agreement during client-side navigation, even when rendering is interrupted or a payload never arrives.
---

## Problem

RedwoodSDK's client-side navigation is URL-first. When a user clicks a link, the runtime pushes the new URL into browser history immediately, then fetches the new page's RSC payload, then commits it to the visible React tree. Immediate address-bar feedback makes navigation feel responsive, and it keeps the back button's semantics intact while content loads.

This ordering creates an inherent exposure: the URL and the rendered page are updated in two separate steps, so there is always a window in which they describe different pages. For a healthy navigation the window closes when the payload commits. The system must guarantee that the window always closes — that the second step cannot be silently lost.

Two kinds of failure work against that guarantee.

The first lives in React's scheduler. To keep the interface responsive during expensive updates, React can render a state update as an interruptible transition: work that the scheduler may pause, deprioritize, or abandon in favor of newer work. Abandonment is safe for ordinary UI state, because a stale value is soon replaced. A navigation payload is not ordinary state: if the render carrying it is abandoned after the URL has already changed, nothing re-attempts it. The payload has fully resolved — the fetch succeeded — yet the old page stays on screen indefinitely, and the address bar disagrees with it. Only a full reload restores agreement.

The second kind is a commit that can never begin. The payload request may hang forever on a stalled network. The payload stream may fail mid-decode. The new page's component tree may throw while rendering. In these cases there is nothing — or nothing renderable — to commit, so no scheduler-side guarantee can cover them.

The challenge is therefore twofold. Once a payload exists, its commit must be non-losable. And when no commit happens, for any reason, the framework must notice and recover on its own — because a URL that permanently disagrees with the page is strictly worse than a reload.

## Solution

### Non-interruptible navigation commits

Navigation payloads commit as default-priority state updates rather than as transitions. A default-priority render is not abandoned by the scheduler: under a starved main thread the commit is delayed, but it always runs. This removes the first failure kind by construction — the payload, once resolved, always reaches the screen.

Server-action payloads keep the transition path. Actions do not change the URL, so an interrupted action render cannot strand the address bar on a page the screen is not showing, and actions retain the responsiveness benefits of interruptible rendering.

### Detecting a missing commit

The pending-navigation tracker described in [Client Navigation Pending Boundaries](./clientNavigationPending.md) records, for each navigation, that a commit is outstanding, and resolves that record only when the payload actually commits to the visible tree — not when the fetch finishes. A navigation whose commit never arrives is therefore an observable state: the pending record simply never resolves.

### Recovering from failed navigations

When the payload request itself fails — a network error, or a stream that dies mid-decode — the navigation's promise chain rejects. Because history was already updated, a rejection left alone strands the browser: the address bar shows the new route, the screen shows the old page, and the framework's own guards against redundant work then block every retry of that route.

A failed navigation is therefore recovered immediately: the pending record is abandoned, the framework's bookkeeping is rolled back to the page that is actually on screen (so a later back/forward to the failed target is treated as a real navigation, not a hash-only change), and the default recovery performs a hard navigation to the intended URL, logged with the original error. Recovery then rethrows the original error, preserving the existing rejection contract for programmatic callers. Apps that prefer their own recovery policy — an error toast, a redirect to an error page — can take over through `onNavigationError`; the original rejection remains observable after their handler returns.

### The commit watchdog

Error recovery handles navigations that fail loudly. What remains is the navigation that neither commits nor errors: a request that hangs forever, a payload that a custom transport never delivers, a render that never completes, or a cause not yet known. Observing a missing commit is not enough; the framework must also leave the state. Apps can arm a commit budget (`navigationTimeoutMs`). If a navigation is still uncommitted when its budget expires, the framework abandons the client-side attempt and performs a hard navigation to the pending URL. A full page load always produces a page whose content matches its URL, so recovery restores agreement no matter what prevented the commit. Apps can substitute their own recovery through `onNavigationTimeout` — for example, surfacing an error — instead of the hard navigation.

The watchdog is opt-in. Recovery is a full page load, and a budget that is too tight turns slow-but-healthy navigations into reloads; whether that trade is acceptable depends on the application's latency profile, so the application chooses the budget, or chooses not to arm the watchdog at all.

### Why the URL still updates first

An alternative design would defer the history push until the payload commits, making divergence impossible for initiated navigations. It was rejected for three reasons. It cannot cover back/forward navigation, where the browser changes the URL before the framework runs. It breaks the existing contract in which the navigation callback and the transport read the target from the current location. And it removes the immediate address-bar feedback that makes navigation feel instant. Guaranteeing the commit, and recovering when one never happens, preserves the URL-first model's responsiveness while bounding the divergence window to one watchdog budget at worst.

## Trade-offs

- Navigation renders are no longer time-sliced. A heavy navigation render blocks the main thread until it completes instead of yielding to input. The framework chooses correctness — the commit always lands — over smoothness during the commit.
- The watchdog cannot distinguish a stuck navigation from a merely slow one. Recovery is correct in both cases, but for a slow navigation it is heavier than the client-side commit would have been. Apps that arm the watchdog should choose a budget a healthy navigation rarely exceeds.

## Correctness Invariants

- A resolved navigation payload must not be dropped by render scheduling.
- A navigation that throws must not strand the browser: it recovers immediately, ending at a page whose content and URL agree.
- A pending navigation resolves when it commits, is superseded, is aborted, is redirected away, or — if the watchdog is armed — its budget expires.
- Watchdog recovery must always end at a page whose content and URL agree; that is why the default recovery is a hard navigation rather than a retry of the client-side pipeline.
- Action payloads never change the commit semantics of navigation payloads, and vice versa.
