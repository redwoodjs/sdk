---
title: Client Navigation Pending Boundaries
description: How RedwoodSDK exposes Suspense-aware pending state for client-side RSC navigations.
---

## Problem

Client-side navigation updates the browser URL before the next React Server Component (RSC) payload has committed to the visible tree. During that gap, the old server-rendered subtree can still be visible even though the address bar already represents the new route, search params, or pagination state.

That behavior is expected at the transport level: history changes first, then the client requests and renders the next RSC payload. The problem is that app code needs a composable way to say:

> This subtree depends on the pending navigation. Hide it behind my normal Suspense fallback until the matching RSC payload has committed.

A plain `<Suspense>` boundary is not enough when the subtree can render immediately from old, already-resolved server props. RedwoodSDK needs to provide the promise that represents the navigation commit.

## Goals

- Keep loading UI app-owned through React `<Suspense fallback>`.
- Track pending navigations by target URL and commit promise.
- Resolve the pending promise when the matching RSC payload commits to the visible React tree, not merely when fetch completes.
- Prevent stale navigation responses from committing after the browser has moved to a newer URL.
- Let apps scope pending UI by all navigations, selected search params, explicit URL parts, or a custom predicate.
- Avoid changing the baseline progressive-enhancement model: links remain normal links without JavaScript.

## Public API

`NavigationPending` and `useNavigationPending` are exported from `rwsdk/client`.

```tsx
import { Suspense } from "react";
import { NavigationPending } from "rwsdk/client";

<Suspense fallback={<ResultsSkeleton />}>
  <NavigationPending searchParams={["search", "page"]}>
    <ResultsTable />
  </NavigationPending>
</Suspense>;
```

By default, `NavigationPending` suspends for any pending client navigation. Apps can narrow this with:

- `searchParams`: shorthand for watching a list of search params.
- `watch`: explicit URL parts (`pathname`, `searchParams`, `hash`).
- `when`: custom predicate that receives copies of `currentUrl` and `pendingUrl`.

If multiple options are supplied, the implementation evaluates them in this order: `when`, then `watch`, then `searchParams`, then the default "any pending navigation" behavior.

## Main Pieces

### The navigation state store

A small store outside React tracks the navigation lifecycle for the whole page:

- the URL represented by the React tree that has committed;
- the latest navigation that has updated history but has not committed, held as a record with an id, a URL snapshot, and a deferred promise.

Components subscribe to this store with `useSyncExternalStore`. When a new navigation starts, any previous pending promise is resolved, so Suspense boundaries from a superseded navigation never hang.

### Beginning and resolving navigations

`initClientNavigation()` and `navigate()` record the pending navigation after history has been updated and before the RSC request is made.

For link clicks and programmatic navigation:

1. Record scroll intent.
2. Update history.
3. Record the pending navigation for the target URL.
4. Run `onNavigate` if present.
5. Request the navigation's RSC payload.
6. If the request fails, abort only that pending navigation.

For `popstate`, the same pending lifecycle is used after ignoring hash-only back/forward changes.

The `onHydrated` callback returned from `initClientNavigation()` and passed to `initClient()` applies scroll, resolves matching pending navigations, and then runs navigation cache maintenance.

### The transport's stale-response guard

The default fetch transport captures the browser URL at the start of a navigation request. That captured URL is used for two things: the actual RSC request URL, and the payload metadata attached to the eventual commit.

When a navigation response returns, the transport checks whether the browser is still on the same navigation document. If the pathname or search params no longer match, the response is discarded. Hash-only differences are ignored because they do not change the server RSC document.

If the discarded response belongs to the active pending navigation, the pending promise is resolved so Suspense does not wait forever.

### Commit means "visible", not "fetched"

The client runtime stores both the RSC payload promise and its metadata in component state. After the payload commits, a React effect forwards the metadata to `onHydrated`. This is what makes the commit signal mean "visible React tree committed" instead of "fetch finished": the resolution of a pending navigation is downstream of the actual render commit, not of the network. (Navigation payloads commit as non-interruptible updates — see [Client Navigation Commit Integrity](./clientNavigationCommitIntegrity.md).)

### The pending boundary

`useNavigationPending()` subscribes to the navigation state store. During render it decides whether the current subtree cares about the pending navigation:

- no options: suspend for any pending navigation;
- `searchParams`: suspend if any watched param value changed;
- `watch`: suspend if any watched URL part changed;
- `when`: suspend if the custom predicate returns `true`.

If the subtree should wait, the hook throws the pending navigation promise. React catches that promise at the nearest `<Suspense>` boundary and renders the app's fallback.

There is one important exception: if React is currently rendering the matching navigation payload, the hook does not suspend. This lets the new payload pass through the same boundary and replace the stale tree. Without this exception, the boundary could keep suspending even while the correct RSC payload is rendering.

## Lifecycle

```text
user clicks link / app calls navigate / browser fires popstate
  -> history is updated
  -> the pending navigation is recorded for the target URL
  -> the previous pending promise resolves if superseded
  -> the RSC navigation request starts
  -> the old tree re-renders and NavigationPending throws the pending promise
  -> the Suspense fallback is shown
  -> the RSC payload response returns
  -> the transport discards it if it no longer matches the browser document URL
  -> the payload is committed to the tree with its navigation metadata
  -> React renders the new payload
  -> NavigationPending sees matching payload metadata and does not suspend
  -> the new tree commits
  -> onHydrated runs
  -> the pending navigation resolves
```

## URL Matching

Navigation commit matching compares the RSC document URL, not the full browser URL. The hash is ignored:

```text
/results?search=abc
/results?search=abc#details
```

Those URLs represent the same server-rendered document, so a response for the first URL may commit after the browser hash changes to the second URL.

Apps can still choose to make a boundary sensitive to hash changes with:

```tsx
<NavigationPending watch={{ hash: true }} />
```

That affects whether the boundary suspends for a pending navigation; it does not mean the RSC response itself is different.

## Custom Transports

Custom transports should pass payload metadata when they update the visible RSC tree for a navigation: the payload's source (`"navigation"`) and the request href.

If metadata is omitted, `onHydrated` falls back to the historical behavior and treats the commit as matching the current pending navigation. That preserves compatibility, but URL-aware pending behavior is more precise when metadata is provided.

## Correctness Invariants

- A pending navigation resolves when it commits, is superseded, is aborted, is redirected away, or — if the opt-in commit watchdog is enabled — its watchdog times out (see [Client Navigation Commit Integrity](./clientNavigationCommitIntegrity.md)).
- A navigation response may only update the tree if it still matches the current browser document URL.
- Hash-only changes do not make an RSC navigation response stale.
- Action payload commits do not resolve navigation pending state.
- Stale or redirected responses must not leave the pending promise unresolved.
- The matching new payload must be allowed to render through `NavigationPending`; otherwise the boundary would block the update it is waiting for.

