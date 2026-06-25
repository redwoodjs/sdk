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

### `navigationState.ts`

This module owns the external navigation store used by React components:

- `currentUrl`: the URL represented by the React tree that has committed.
- `pending`: the latest navigation that has updated history but has not committed.
- `beginPendingNavigation(url)`: creates a pending navigation with an id, URL snapshot, and deferred promise.
- `commitPendingNavigation(href)`: resolves and clears the pending navigation when a matching payload commits.
- `abortPendingNavigation(id?)`: resolves and clears a pending navigation when it is superseded, redirected, or fails.
- `subscribeNavigationState()` / `getNavigationSnapshot()`: power `useSyncExternalStore`.

When a new navigation starts, any previous pending promise is resolved. This prevents old Suspense boundaries from hanging after they are superseded.

### `navigation.ts`

`initClientNavigation()` and `navigate()` begin the pending navigation after history has been updated and before the RSC request is made.

For link clicks and programmatic navigation:

1. Record scroll intent.
2. Update history.
3. Call `beginPendingNavigation(targetUrl)`.
4. Run `onNavigate` if present.
5. Call `__rsc_callServer(null, null, "navigation")`.
6. If the call throws, abort only that pending navigation id.

For `popstate`, the same pending lifecycle is used after ignoring hash-only back/forward changes.

`onHydrated(meta)` is returned from `initClientNavigation()` and passed to `initClient()`. It applies scroll, commits matching pending navigations, and then runs navigation cache maintenance.

### `client.tsx`

The default fetch transport captures the browser URL at the start of a navigation request. That captured URL is used for two things:

1. The actual `?__rsc` request URL.
2. The payload metadata passed to `setRscPayload`.

When a navigation response returns, the transport checks whether the browser is still on the same navigation document. If the pathname or search params no longer match, the response is discarded. Hash-only differences are ignored because they do not change the server RSC document.

If the discarded response belongs to the active pending navigation, the pending promise is resolved via `abortPendingNavigation()` so Suspense does not wait forever.

`Content` stores both the RSC payload promise and metadata in state, then wraps rendering with `NavigationPayloadProvider`. After the payload commits, a React effect calls `onHydrated(meta)`. This is what makes the commit signal mean "visible React tree committed" instead of "fetch finished".

### `navigationPending.tsx`

`useNavigationPending()` subscribes to the external navigation store with `useSyncExternalStore`. During render it decides whether the current subtree cares about the pending navigation:

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
  -> beginPendingNavigation(targetUrl)
  -> old pending promise resolves if superseded
  -> RSC navigation request starts
  -> old tree re-renders and NavigationPending throws pending.promise
  -> Suspense fallback is shown
  -> RSC payload response returns
  -> transport discards it if it no longer matches the browser document URL
  -> setRscPayload(payload, { source: "navigation", href })
  -> React renders the new payload
  -> NavigationPending sees matching payload metadata and does not suspend
  -> new tree commits
  -> onHydrated(meta) runs
  -> commitPendingNavigation(meta.href)
  -> pending promise resolves
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

Custom transports should pass `RscPayloadMeta` to `transportContext.setRscPayload` when they update the visible RSC tree:

```ts
transportContext.setRscPayload(streamData, {
  source: "navigation",
  href: requestHref,
});
```

If metadata is omitted, `onHydrated` falls back to the historical behavior and treats the commit as matching the current pending navigation. That preserves compatibility, but URL-aware pending behavior is more precise when metadata is provided.

## Correctness Invariants

- A pending navigation resolves when it commits, is superseded, is aborted, or is redirected away.
- A navigation response may only update the tree if it still matches the current browser document URL.
- Hash-only changes do not make an RSC navigation response stale.
- Action payload commits do not resolve navigation pending state.
- Stale or redirected responses must not leave the pending promise unresolved.
- The matching new payload must be allowed to render through `NavigationPending`; otherwise the boundary would block the update it is waiting for.

## Open Follow-Ups

These are tracked separately from the initial implementation:

- [#1242](https://github.com/redwoodjs/sdk/issues/1242): Track client navigation commits with request ids. This would distinguish rapid navigations to the exact same URL.
- [#1243](https://github.com/redwoodjs/sdk/issues/1243): Abort superseded in-flight RSC navigation fetches. This is a resource optimization; stale-response guards remain the correctness mechanism.
- [#1244](https://github.com/redwoodjs/sdk/issues/1244): Decide stale navigation handling for the deprecated realtime transport. This is separate from `use-synced-state`.
