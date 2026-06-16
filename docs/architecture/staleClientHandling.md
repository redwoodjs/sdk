# Stale Client Handling

This document describes how RedwoodSDK recovers when a browser tab outlives the deployment it was opened on.

## The Core Challenge

A RedwoodSDK deployment replaces the worker, the client bundle, and the hashed asset files as a single unit. A tab that was opened before the deployment may still be running the previous build's client code. When that tab tries to continue interacting with the application, two things can go wrong.

First, the tab may try to load a client chunk whose content hash no longer exists. RedwoodSDK ships client components as hashed JavaScript files, and a new build renames or removes the files the old build references. The browser then fails to fetch the chunk, and React crashes into a blank page.

Second, the tab may hold a `use-synced-state` WebSocket session. A deploy restarts the worker, and the WebSocket drops. The tab is now running stale code against a fresh worker, and the live state it was viewing may no longer make sense.

The obvious fix is to reload the page as soon as something goes wrong. But a deploy is not an atomic event from the tab's perspective. The worker may restart before the new assets are reachable, or the new worker may be live while a CDN or edge node still serves old responses. Reloading immediately can land the user on a page that is also broken. The recovery flow therefore waits until it can confirm the current route is loadable before it reloads.

## What We Observe Instead of a Server Signal

The previous approach asked the server to compare a client build ID against the worker's build ID and return a `409` response. That works when the server is already running the new build and is able to answer. It does not work while the worker is restarting or while the deploy is still propagating.

The current approach recovers from observable failures instead. The client does not need to know whether the server thinks it is stale. It only needs to notice that something it expected to work no longer works, and then wait for the application to be reachable again.

There are two observable failure paths.

The first is a failed dynamic import. When the tab tries to load a `"use client"` chunk and the browser returns an error such as `Failed to fetch dynamically imported module`, the client knows the old build's assets are gone. The framework owns the client-side module loader, so it can intercept that failure before React crashes.

The second is a broken `use-synced-state` RPC session. The capnweb WebSocket connection signals when the RPC transport breaks. That break can happen because of a deploy, but it can also happen because of ordinary network interruption. In either case, the right response is the same: wait until the application is reachable again, then reload.

## The Recovery Flow: Wait, Then Reload

When either failure is observed, the client enters a recovery flow called `"reloadWhenReady"`. The flow does not try to diagnose the cause. It simply waits until the current page can be fetched successfully, then reloads.

The reason for waiting is that a fetch of the current route is the only signal that proves the deploy is ready for this user. A build-version endpoint could report the new build ID while the worker responsible for the user's URL is still starting. A 200 response on the actual page means the worker is serving HTML for that URL.

The flow polls the current route with `cache: "no-store"` and `Accept: text/html`. It uses exponential backoff with jitter, capped at ten seconds, so it does not hammer the server. Once the route returns HTTP 200, the flow calls `window.location.reload()`. If the current route is not loadable within thirty seconds, the flow falls back to the index route (`/`). If `/` returns 200, it navigates there instead.

Only one recovery controller runs at a time. If a second failure occurs while recovery is already in progress, the existing controller reloads the page immediately.

## The Two Failure Paths

The dynamic import path is hooked inside `sdk/src/runtime/imports/client.ts`. Every `"use client"` module is loaded through the framework's module lookup. When `loadModule()` catches a dynamic import failure whose message matches `dynamically imported module`, it starts recovery and returns a never-resolving promise. That promise keeps React's Suspense boundary suspended until the reload, so the tab does not crash before recovery completes.

The WebSocket path is hooked inside `sdk/src/use-synced-state/client-core.ts`. When capnweb reports that the RPC session is broken, the client notifies any status listeners with `"disconnected"` and starts recovery. The old reconnect-and-backoff loop has been removed, because reconnecting to a restarted Durable Object would preserve the stale client build. Reloading gives the tab a fresh start.

## Configuring Recovery

Applications opt into recovery through `initClient()`. The framework provides one built-in preset, `"reloadWhenReady"`, and both triggers default to it.

```ts
import { initClient } from "rwsdk/client";

initClient({
  onDisconnected: "reloadWhenReady",
  onModuleNotFound: "reloadWhenReady",
});
```

Most applications will not need to change these defaults. The preset is the resilient behavior described above.

## Custom Callbacks and Application UI

Applications that want to show their own UI while waiting can pass a callback instead of the preset. The callback receives a `RecoveryController` that exposes the current state, the number of attempts, the elapsed time, and actions to retry now or reload immediately.

```ts
initClient({
  onDisconnected: (controller) => {
    console.log("Connection lost, waiting for deploy", controller.state);
  },
});
```

The SDK does not render any overlay, banner, or spinner. Recovery UI is application land. The callback exists so the application can observe the flow, render what it wants, log to analytics, or override the behavior entirely by calling `controller.reload()`.

## What Is Not Covered

This mechanism is intentionally scoped to the two failure paths above.

It does not intercept ordinary RSC or action fetches that happen to fail for other reasons, such as validation errors or network blips that do not indicate a deploy. It does not queue requests transparently. It does not use a service worker. It does not maintain a persistent connection or try to remap old module names to new asset names.

It also does not add any server-side stale detection, build-version plumbing, or dedicated health endpoint. The recovery is driven entirely by what the client can observe and by whether the current route is loadable.
