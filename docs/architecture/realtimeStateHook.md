# Realtime Shared State Hook

This document describes the realtime synced state feature that keeps shared values aligned across browser sessions through the worker runtime.

## Challenge

Applications need a hook with the same ergonomics as `useState` that keeps values synchronised between clients while running inside the worker runtime. The solution must avoid polling, operate within the existing worker deployment model, and support multiple independent keys without leaking subscriptions.

## Overview

The design combines a Cloudflare Durable Object that stores key-value pairs, a CapnWeb RPC surface for subscription updates, and a client hook factory that wraps this RPC surface behind a React-compatible state API.

## Worker Responsibilities

- `SyncedStateServer` is a Durable Object that stores state values in memory, tracks subscribers per key, and broadcasts updates to connected clients via CapnWeb stubs.
- The Durable Object exposes a CapnWeb RPC target with `getState`, `setState`, `subscribe`, and `unsubscribe` methods. This keeps the RPC surface aligned with the client hook expectations.
- Worker routes proxy `/__synced-state` requests to the Durable Object using `newWorkersRpcResponse`.

## Client Hook Responsibilities

- The hook invokes `getState` for the requested key, subscribes to updates, and synchronises local state when the Durable Object pushes new values. Updates are applied optimistically in the client and forwarded through `setState`, which fans out the change to every subscriber.

## Data Flow

1. A component calls `useSyncedState(initialValue, key)`.
2. The hook ensures the shared WebSocket RPC session exists and fetches the current value from the Durable Object.
3. The hook subscribes to further updates; the Durable Object records the subscriber and will invoke it on updates.
4. When any client triggers the setter, the hook sends `setState` to the Durable Object.
5. The Durable Object updates its map, iterates subscribers for the key, and invokes their RPC stubs, which push the new value to each client hook instance.
6. Each hook instance updates its local React state, keeping the UI in sync.

## Key Transformation

Applications often need to scope state to individual users or other request-specific context. The key transformation feature allows worker-level code to intercept and modify state keys before they reach the Durable Object.

The `SyncedStateServer.registerKeyHandler` method accepts an async function that receives a client-provided key and returns a transformed key. The handler runs in the worker request context where `requestInfo` and session data are available.

When a handler is registered, the worker routes create an RPC proxy that sits between the client and the Durable Object. For each RPC method call (`getState`, `setState`, `subscribe`, `unsubscribe`), the proxy invokes the handler to transform the key, then forwards the call to the Durable Object with the transformed key. The Durable Object operates only on transformed keys and never sees the original client-provided keys.

This approach keeps scoping logic centralized in the worker while maintaining security. The client provides simple, unscoped keys like `"counter"`, and the worker transforms them to scoped keys like `"user:123:counter"` based on the authenticated session. If the handler throws an error, the error propagates to the client.

When no handler is registered, keys pass through unchanged, and the worker routes forward requests directly to the Durable Object without creating a proxy.

## Failure Handling

- Subscriber invocation failures remove the subscriber stub from the Durable Object, preventing repeated errors.
- If the Durable Object binding is missing, worker routes return a 500 response instructing the developer to restart the dev server.

For planned enhancements to error handling, retry logic, and offline queues, see [Realtime State Error Handling and Offline Queue](./realtimeStateErrorHandling.md).

## Testing

- Unit tests cover the Durable Object's subscription handling and the client hook's optimistic updates, subscription dispatch, and cleanup logic using injected dependencies.
