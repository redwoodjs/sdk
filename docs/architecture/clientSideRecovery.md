# Client-Side Recovery

A RedwoodSDK application is split between a worker that runs on the server and a client bundle that runs in the browser. The two are built together, and a deployment replaces both at the same time. When a browser tab crosses that boundary it can end up running code that no longer matches the assets the server is serving. RedwoodSDK handles this with a small client-side recovery flow that waits until the application is reachable again and then reloads the page.

## Where the problem appears

The most common way this surfaces is after a redeploy. RedwoodSDK ships client components as individual JavaScript files whose filenames include content hashes. A new build renames those files. A tab that was opened before the redeploy still references the old names, so when it later tries to load a chunk it has not yet needed, the browser fails to fetch it and React crashes into a blank page.

This can also happen outside of deploys. A CDN or edge node can serve a stale HTML shell that references chunks the origin no longer has. A long-lived tab can sit idle long enough that its assets are evicted from the edge. In each case the tab is holding code that may no longer be valid, and the safest recovery is to reload once the application is confirmed reachable.

## Why immediate reload is not enough

The natural response is to reload as soon as the failure is detected. But a deployment is not atomic from the tab's point of view. The new worker may be live before its assets are reachable, or assets may be reachable before the worker responsible for the user's URL has finished starting. Reloading immediately can land the user on a page that is also broken, either because the HTML loads but a referenced chunk is still missing, or because the route itself is not yet serving.

The recovery flow therefore separates detection from the decision to reload. It detects the failure, enters a waiting state, and polls the current route until that route returns HTTP 200. Only then does it reload. A 200 on the actual route is the signal that matters, because it means the worker for that URL is up and serving HTML. A build-version endpoint could not provide the same guarantee: the new build ID might be reported while the specific route the user needs is still unavailable.

## The recovery flow

The recovery flow is exposed through `initClient()` as a single trigger:

- `onModuleNotFound` fires when a `"use client"` dynamic import fails with a missing-chunk error.

It accepts either the built-in `"reloadWhenReady"` preset string or a callback that receives a `RecoveryController`. The SDK does not enable recovery by default, because an unexpected page reload can be worse than a stale tab, so the application opts in explicitly.

When the trigger fires and is configured, the SDK creates a `RecoveryController` and starts polling the current route with `cache: "no-store"` and `Accept: text/html`. To reduce the chance of a thundering herd after a mass failure event, the first poll is delayed by a random startup jitter of up to one second, and subsequent polls use exponential backoff with jitter, capped at thirty seconds.

A response is considered "ready" only when:

- it returns HTTP 200,
- its `Content-Type` includes `text/html`,
- its body contains HTML markup (`<!doctype html` or `<html`), and
- if the current page has a `hydrate-root` element, the response contains a matching root element with the same tag name.

The hydrate-root check protects against preview or health-check fallbacks that return a bare `200 OK` plain-text response while the app is still deploying. If the current page does not have a hydrate-root element, the check falls back to the HTML-only validation.

The health-check URL is normalized before fetching: any trailing DNS-root dot on the hostname is removed, and query strings and hashes are stripped. This prevents Cloudflare Workers route mismatches that can occur when the browser preserves a trailing dot in `window.location.href`.

Once the route passes these checks, the controller calls `window.location.reload()`. If the current route is not loadable within roughly thirty seconds, the controller falls back to the index route (`/`). The fallback timeout itself is jittered by up to ten seconds so tabs that reach the timeout do not all hit `/` at the same instant.

Only one recovery controller runs at a time. If a second failure occurs while recovery is already in progress, the second call is ignored.

## WebSocket sessions

`use-synced-state` keeps a WebSocket RPC session open between the browser and a Durable Object. When the worker restarts after a deploy, the WebSocket drops. The SDK reconnects with exponential backoff and re-subscribes to active keys once the connection is back. It does not reload the page on disconnect, because a dropped connection is a normal platform event and the tab's client code is still valid.

Applications that want to reload on disconnect can do so through `onStatusChange` or other application-level hooks; it is not part of the built-in recovery flow.

## Hooking the failure path

The dynamic import path is caught inside `sdk/src/runtime/imports/client.ts`. Every `"use client"` module is loaded through the framework's module lookup. When `loadModule()` catches a dynamic import failure whose message matches `dynamically imported module`, it starts recovery and returns a never-resolving promise. That promise keeps React's Suspense boundary suspended until the reload, so the tab does not crash before recovery completes.

## Configuring recovery

Applications opt into recovery through `initClient()`. The framework provides one built-in preset, `"reloadWhenReady"`:

```ts
import { initClient } from "rwsdk/client";

initClient({
  onModuleNotFound: "reloadWhenReady",
});
```

Applications that want to show their own UI, log to analytics, or override the behavior can pass a callback. The callback receives a `RecoveryController` with `state`, `attempts`, `elapsedMs`, `retry()`, and `reload()`.

```ts
initClient({
  onModuleNotFound: (controller) => {
    console.log("Chunk missing, waiting for application", controller.state);
  },
});
```

The SDK does not render any overlay, banner, or spinner. Recovery UI is application land.

## Scaling trade-offs

The polling design assumes that failures are relatively uncorrelated in normal operation. After a mass failure event such as a redeploy or outage recovery, many tabs can enter recovery at the same time. The SDK mitigates this with three sources of jitter: a random startup delay before the first poll, jittered exponential backoff between polls, and a jittered fallback timeout. These spread recovery attempts over time and reduce the chance that all affected tabs hit the server simultaneously.

The health check is a full HTML GET with `cache: "no-store"`. This is heavier than a HEAD request or a dedicated health endpoint, but it is the only signal that proves the user's actual route is renderable. Applications that need lighter probes, custom backoff schedules, or server-side coordination can opt out of the built-in preset and implement their own recovery logic in the callback.

## What is not covered

This mechanism is intentionally scoped to the missing-client-chunk path.

It does not intercept ordinary RSC or action fetches that fail for other reasons, such as validation errors or transient network blips. It does not queue requests transparently. It does not use a service worker. It does not maintain a persistent connection or try to remap old module names to new asset names. It also does not add any server-side stale detection, build-version plumbing, or dedicated health endpoint. The recovery is driven entirely by what the client can observe and by whether the current route is loadable.
