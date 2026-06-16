# Client-Side Recovery

A RedwoodSDK application is split between a worker that runs on the server and a client bundle that runs in the browser. The two are built together, and a deployment replaces both at the same time. When a browser tab crosses that boundary, or when the connection it depends on is interrupted, the tab can end up in a state where the code it is running no longer matches the code it needs to load. RedwoodSDK handles this with a client-side recovery flow that waits until the application is reachable again and then reloads the page.

## Where the problem appears

The most common way this surfaces is after a redeploy. RedwoodSDK ships client components as individual JavaScript files whose filenames include content hashes. A new build renames those files. A tab that was opened before the redeploy still references the old names, so when it later tries to load a chunk it has not yet needed, the browser fails to fetch it and React crashes into a blank page.

The same boundary appears in real-time APIs. `use-synced-state` keeps a WebSocket RPC session open between the browser and a Durable Object. When the worker restarts after a deploy, the WebSocket drops. The client can reconnect, but it is still running the previous build's code against a fresh worker and a fresh Durable Object state. Continuing in that state risks showing the user data or behavior that no longer matches what the server expects.

These failures are not strictly limited to deploys. A network interruption can also break a `use-synced-state` session. A CDN or edge node can serve a stale HTML shell that references chunks the origin no longer has. A worker can restart for reasons unrelated to a release. In each case the tab is holding code or state that may no longer be valid, and the safest recovery is to reload once the application is confirmed reachable.

## Why immediate reload is not enough

The natural response is to reload as soon as the failure is detected. But a deployment is not atomic from the tab's point of view. The new worker may be live before its assets are reachable, or assets may be reachable before the worker responsible for the user's URL has finished starting. Reloading immediately can land the user on a page that is also broken, either because the HTML loads but a referenced chunk is still missing, or because the route itself is not yet serving.

The recovery flow therefore separates detection from the decision to reload. It detects the failure, enters a waiting state, and polls the current route until that route returns HTTP 200. Only then does it reload. A 200 on the actual route is the signal that matters, because it means the worker for that URL is up and serving HTML. A build-version endpoint could not provide the same guarantee: the new build ID might be reported while the specific route the user needs is still unavailable.

## The recovery flow

The recovery flow is exposed through `initClient()` as two independent triggers:

- `onDisconnected` fires when a `use-synced-state` RPC session breaks.
- `onModuleNotFound` fires when a `"use client"` dynamic import fails with a missing-chunk error.

Each trigger accepts either the built-in `"reloadWhenReady"` preset string or a callback that receives a `RecoveryController`. The SDK does not enable either trigger by default, because the right behavior depends on the application: an unexpected page reload can be worse than a stale tab, so the application opts in explicitly.

When a trigger fires and is configured, the SDK creates a `RecoveryController` and starts polling the current route with `cache: "no-store"` and `Accept: text/html`. The poll uses exponential backoff with jitter, capped at ten seconds, to avoid hammering the server. Once the route returns HTTP 200, the controller calls `window.location.reload()`. If the current route is not loadable within thirty seconds, the controller falls back to the index route (`/`). If `/` returns 200, it navigates there instead.

Only one recovery controller runs at a time. If a second failure occurs while recovery is already in progress, the existing controller reloads the page immediately.

## Hooking the failure paths

The dynamic import path is caught inside `sdk/src/runtime/imports/client.ts`. Every `"use client"` module is loaded through the framework's module lookup. When `loadModule()` catches a dynamic import failure whose message matches `dynamically imported module`, it starts recovery and returns a never-resolving promise. That promise keeps React's Suspense boundary suspended until the reload, so the tab does not crash before recovery completes.

The WebSocket path is caught inside `sdk/src/use-synced-state/client-core.ts`. When capnweb reports that the RPC session is broken, the client notifies any status listeners with `"disconnected"` and starts recovery. The previous reconnect-and-backoff loop has been removed, because reconnecting to a restarted Durable Object would preserve the stale client build. Reloading gives the tab a fresh start.

## Configuring recovery

Applications opt into recovery through `initClient()`. The framework provides one built-in preset, `"reloadWhenReady"`:

```ts
import { initClient } from "rwsdk/client";

initClient({
  onDisconnected: "reloadWhenReady",
  onModuleNotFound: "reloadWhenReady",
});
```

Applications that want to show their own UI, log to analytics, or override the behavior can pass a callback. The callback receives a `RecoveryController` with `state`, `attempts`, `elapsedMs`, `retry()`, and `reload()`.

```ts
initClient({
  onDisconnected: (controller) => {
    console.log("Connection lost, waiting for application", controller.state);
  },
});
```

The SDK does not render any overlay, banner, or spinner. Recovery UI is application land.

## What is not covered

This mechanism is intentionally scoped to the two failure paths above.

It does not intercept ordinary RSC or action fetches that fail for other reasons, such as validation errors or transient network blips. It does not queue requests transparently. It does not use a service worker. It does not maintain a persistent connection or try to remap old module names to new asset names. It also does not add any server-side stale detection, build-version plumbing, or dedicated health endpoint. The recovery is driven entirely by what the client can observe and by whether the current route is loadable.
