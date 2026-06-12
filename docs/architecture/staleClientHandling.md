# Stale Client Handling

This document describes how RedwoodSDK detects and recovers from browser tabs that are still running an older build of the application after a new deployment.

## The Core Challenge

A RedwoodSDK deployment changes the server worker, the client bundle, and the asset files together. A browser tab that was opened before the deployment may still be running the previous build's client code. When that tab makes a request to the newly deployed server, the client and server can disagree on the shape of server actions, the set of client components available for hydration, the RSC payload format, or the `use-synced-state` WebSocket protocol. This mismatch can cause subtle hydration errors, failed actions, or broken real-time state.

Long-lived tabs and slow networks make the problem worse. A user might leave a dashboard open overnight, or load stale HTML that references assets which no longer exist.

## The Build-Time Foundation: `VITE_RWSDK_BUILD_ID`

The mechanism starts at build time. The RedwoodSDK Vite plugin generates a unique identifier for each build:

```ts
process.env.VITE_RWSDK_BUILD_ID ??= randomUUID();
```

This value is exposed to both the worker and the client through `import.meta.env.VITE_RWSDK_BUILD_ID`. Because the identifier is generated once per build and embedded in both bundles, it gives the server and client a shared way to answer the question: "Do we both expect the same build?"

## The Client-Side Contract: Sending the Build ID

The client sends its build ID on every server-bound request that is issued by RedwoodSDK's own runtime:

- **RSC, action, and navigation fetches** send the build ID in the `x-rwsdk-client-version` request header.
- **`use-synced-state` WebSocket connections** send the build ID in the `__rwsdk_client_version` query parameter.

Asset requests do not carry an explicit version signal. Their filenames already contain content hashes, so a stale client that requests an old asset receives a 404 from `env.ASSETS.fetch`.

## The Server-Side Contract: Detecting and Signaling Staleness

`defineApp()` checks for staleness before routing or asset forwarding. If the client's reported build ID does not match the server's current build ID, the server returns a 409 response with a custom header:

```ts
new Response(null, {
  status: 409,
  headers: {
    "x-rwsdk-stale": "reload",
    "cache-control": "no-store",
  },
});
```

The `no-store` directive prevents browsers and CDNs from caching the stale response. The empty body keeps the response small.

## The Recovery Path: Full Page Reload

All server responses flow through `fetchTransport` in `client.tsx`. After awaiting the response, the transport checks for the stale header:

```ts
const response = await fetchPromise;

if (isStaleReloadResponse(response)) {
  window.location.reload();
  return undefined;
}
```

A stale reload is a full page load. The browser fetches fresh HTML from the worker and fresh content-hashed assets. The new client bundle has no stale state, so the framework does not maintain a session-level guard against reload loops.

For `use-synced-state`, the WebSocket handshake response is checked and the same reload is triggered.

## Custom Stale Policy

`defineApp` accepts an optional `stale` configuration for applications that need custom behavior:

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

## What Is Not Covered

This mechanism is intentionally scoped to SPA-style client-side traffic:

- Initial full-page loads are not checked, because the browser already fetches fresh HTML.
- Asset requests are not checked, because stale content-hashed assets naturally return 404.
- Requests outside RedwoodSDK routing are not checked.

## Security Considerations

The build ID is not a secret. It is embedded in the client bundle and sent with every request. Stale detection is a consistency feature, not an authorization boundary.

The 409 response body is empty and carries `cache-control: no-store`, so it cannot poison shared caches.

Custom `onStale` handlers receive the client's reported version as untrusted input. If logged or rendered, it should be handled accordingly.
