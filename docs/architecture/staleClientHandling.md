# Stale Client Handling

## Problem

When a RedwoodSDK application is deployed, the server worker, client bundle, and asset files all change atomically for a given build. A browser tab that was opened before the deployment may still be running the previous build's client code. If that tab makes a request to the newly deployed server, the client and server can disagree on:

- The shape of server actions and their serialization
- The set of client components available for hydration
- The set of RSC payload types that can be streamed
- The WebSocket protocol for `use-synced-state`

This mismatch can manifest as subtle hydration errors, failed actions, or broken real-time state. The problem is especially pronounced for long-lived tabs (e.g., a dashboard left open overnight) and for users on slow networks who may load stale HTML that references assets that no longer exist.

## Goals

1. Detect when a client request comes from a stale build.
2. Signal the client to reload so it fetches the current build's HTML and assets.
3. Avoid false positives — a reload should only happen when there is a genuine build mismatch.
4. Keep the mechanism simple and stateless on the client.

## Non-Goals

- Detecting stale clients on every request type. Full-page navigations naturally load fresh HTML; only SPA-style client-side fetches need explicit stale detection.
- Providing a custom UI for stale states. The framework provides a hook for custom policies, but the default is a silent reload.
- Supporting granular hot updates. This mechanism is for build-level mismatch, not for HMR.

## Solution

### Build identity

Each build gets a unique identifier generated at Vite plugin initialization:

```ts
process.env.VITE_RWSDK_BUILD_ID ??= randomUUID();
```

This value is available to both worker and client code via `import.meta.env.VITE_RWSDK_BUILD_ID`.

### How the client sends its build identity

The client sends its build ID on every server-bound fetch:

- **RSC / action / navigation fetches**: via the `x-rwsdk-client-version` request header
- **`use-synced-state` websocket**: via the `__rwsdk_client_version` query parameter

Asset requests do not carry a version signal. Instead, stale assets are detected naturally: content-hashed filenames from old builds return 404s from `env.ASSETS.fetch`.

### How the server checks for staleness

`defineApp()` includes a stale check before routing or asset forwarding:

```ts
if (isStaleRequest(request, source, import.meta.env.VITE_RWSDK_BUILD_ID)) {
  return createStaleReloadResponse();
}
```

`isStaleRequest` compares the client's build ID (from header or query) against the server's current build ID. If they differ, the request is stale.

### The stale response

The server returns a 409 response with a custom header:

```ts
new Response(null, {
  status: 409,
  headers: {
    "x-rwsdk-stale": "reload",
    "cache-control": "no-store",
  },
});
```

The `no-store` directive prevents browsers and CDNs from caching the stale response.

### How the client handles the stale response

All server responses flow through `fetchTransport` in `client.tsx`. After awaiting the response, it checks for the stale header:

```ts
const response = await fetchPromise;

if (isStaleReloadResponse(response)) {
  window.location.reload();
  return undefined;
}
```

A stale reload is a full page load. The browser fetches fresh HTML from the worker and fresh content-hashed assets. The new client bundle has no stale state, so no session-level guard is needed.

For `use-synced-state`, the websocket handshake response is checked in `client-core.ts` and the same reload is triggered.

### Custom stale policy

`defineApp` accepts an optional `stale` configuration:

```ts
defineApp(routes, {
  stale: {
    onStale: (event) => {
      // Custom handling — return a Response or undefined
      console.log("Stale client detected:", event.clientVersion);
    },
  },
});
```

The `onStale` callback receives a `StaleEvent` containing the request, source, and both build versions. Returning a Response sends that response to the client. Returning undefined falls back to the default reload behavior.

## Scope

This mechanism covers:

- Client-side navigation (RSC fetches with `?__rsc`)
- Server actions (POST fetches with `?__rsc_action_id`)
- `use-synced-state` websocket connections

It does not cover:

- Initial full-page loads (fresh HTML is always served)
- Asset requests (handled by content-hashed 404s)
- External API calls (outside RedwoodSDK routing)

## Security considerations

- The build ID is not a secret. It is embedded in the client bundle and sent with every request. Stale detection is a consistency feature, not an authorization boundary.
- The 409 response body is empty and carries `cache-control: no-store`, so it cannot poison shared caches.
- Custom `onStale` handlers receive untrusted input (the client's reported version). If logged or rendered, it should be treated as untrusted data.
