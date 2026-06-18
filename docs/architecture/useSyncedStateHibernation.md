# Realtime Shared State Hook (Hibernation Transport)

This document describes the hibernation transport for `useSyncedState`. It keeps shared values aligned across browser sessions through a Durable Object that can hibernate when idle, while preserving the existing hook API.

## Overview

The transport splits work between the Worker and a Durable Object. The Worker owns each active WebSocket connection and any logic that needs request context. The Durable Object owns room state, subscriptions, and broadcasts. Because the Durable Object receives already-transformed keys and never needs request context, it can use Cloudflare's Hibernation WebSocket API and sleep between messages.

State is persisted to Durable Object storage, and subscriptions are stored in the WebSocket attachment so they survive hibernation.

## Worker Responsibilities

- The hibernation route in `sdk/src/use-synced-state/worker-hibernation.mts` accepts browser WebSocket upgrades at `/__synced-state`.
- It resolves the room name using the registered room handler with the current request context.
- It opens a second WebSocket to the hibernation Durable Object and sits between the browser and the DO.
- It captures a snapshot of `RequestInfo` for each connection.
- For every client message, it invokes the registered key handler with the original key and the captured context, producing a `storageKey`. It forwards the message to the DO with both the user-facing `key` and the transformed `storageKey`.
- It forwards DO messages back to the browser unchanged, because the DO already uses the user-facing key for responses and broadcasts.

## Durable Object Responsibilities

- `SyncedStateServerHibernation` in `sdk/src/use-synced-state/SyncedStateServerHibernation.mts` stores state by `storageKey` and broadcasts updates to subscribers using the user-facing `key`.
- It persists state to Durable Object storage, loading keys lazily into an in-memory cache when first accessed.
- It tracks subscribers per `storageKey` in memory and persists subscription metadata in the WebSocket attachment.
- On every `webSocketMessage`, it rehydrates subscriptions from the attachment so broadcasts continue to work after hibernation.
- It exposes RPC methods `getState` and `setState` so application code can read and write state from server-side callers.

## Client Hook Responsibilities

- The client core in `sdk/src/use-synced-state/client-core-hibernation.ts` maintains one WebSocket connection per endpoint.
- It exposes `getState`, `setState`, `subscribe`, and `unsubscribe` methods to application hooks.
- It tracks active subscriptions in a module-scoped set. When the connection drops, it reconnects with exponential backoff and re-subscribes to every active key.
- It notifies listeners of connection status changes: `connected`, `disconnected`, and `reconnecting`.

## Data Flow

1. A component calls `useSyncedState(initialValue, key, roomId?)` from `rwsdk/use-synced-state/hibernation/client`.
2. The browser opens a WebSocket to `/__synced-state`.
3. The Worker resolves the room, opens a second WebSocket to the hibernation DO, and captures request context.
4. The hook sends `subscribe` and `getState` messages for the requested key.
5. The Worker transforms the key via the registered key handler and forwards the message with a `storageKey`.
6. The DO persists the subscription, reads state from storage, and returns the value.
7. When any client or server caller sends `setState`, the DO updates storage, broadcasts an `update` message to all subscribers, and includes the user-facing `key`.
8. Each subscriber hook updates its local React state, keeping the UI in sync.

## Protocol

Messages are JSON envelopes with a protocol version and a `kind` discriminator:

```ts
{ v: 1, kind: "setState", key: "counter", value: 1, id: "abc" }
```

Client message kinds are `getState`, `setState`, `subscribe`, and `unsubscribe`. Server message kinds are `getState`, `setState`, `subscribe`, `unsubscribe`, `update`, and `error`. The Worker adds a `storageKey` field when forwarding client messages to the DO.

The protocol is intentionally simple and does not support chunked streaming, because the payloads are small key/value operations.

## Key Transformation

Applications register a key handler with `SyncedStateServerHibernation.registerKeyHandler`. The handler receives the client-provided key and a DO stub, and returns a transformed key. It runs in the Worker on every client message, so it has full access to the request context captured at upgrade time. The DO never sees the original key.

When no key handler is registered, keys pass through unchanged and `storageKey` equals `key`.

## Failure Handling

- If the Worker cannot open a WebSocket to the DO, it returns a non-101 response and the browser connection fails.
- If the DO receives an unsupported protocol version or an invalid message shape, it sends an `error` message to that socket.
- When the browser socket closes, the DO removes it from subscription sets. Reconnection is handled by the client core.
- The client tracks the last incoming message timestamp. If no message is received for a timeout period, it assumes the socket is silently dead and force-closes it to trigger reconnection.
- Pending requests in flight during a close are rejected; mutations sent while disconnected are queued and sent on reconnect.

## Testing

- Unit tests in `sdk/src/use-synced-state/__tests__/SyncedStateServerHibernation.test.mts` cover state persistence, subscription rehydration, protocol validation, and DO eviction.
- A dedicated playground in `playground/use-synced-state-hibernation` exercises the transport end-to-end.
