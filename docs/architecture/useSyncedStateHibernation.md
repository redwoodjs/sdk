# Realtime Shared State Hook (Hibernation Transport)

This document describes the hibernation transport for `useSyncedState`. It keeps shared values aligned across browser sessions through a Durable Object that can hibernate when idle, while preserving the existing hook API.

## The Challenge: Keeping Shared State Alive Without Keeping the Durable Object Awake

Realtime state has two competing requirements. On one hand, users expect a local-looking state hook whose value stays in sync across tabs and devices. On the other hand, Cloudflare bills Durable Objects for wall-clock duration, so an idle tab with an open WebSocket should not consume resources.

The original `useSyncedState` transport uses CapnWeb over the standard WebSocket API. The browser connects to the Worker, the Worker creates a CapnWeb RPC target, and the Durable Object stores the browser's subscription callbacks as `RpcStub` objects. As long as the DO holds those stubs, it cannot be evicted, so it stays active for the entire subscription lifetime. This makes idle tabs expensive.

A hibernation transport must solve the same sync problem while allowing the DO to sleep between messages. This introduces three domain-specific challenges.

### 1. The DO Cannot Hold Capabilities to the Browser

Cloudflare's hibernation WebSocket API lets a DO sleep, but it cannot hold `RpcStub` objects that point back to the browser because those capabilities tie the DO's lifetime to the client. Any subscription system must be rebuilt around socket attachments and explicit messages instead of remote callbacks.

### 2. Request Context Must Survive Hibernation

Applications often scope state to users or other request-specific context. In the original transport, `registerKeyHandler` runs inside the Worker and can read `requestInfo.ctx`. In the hibernation transport, the Worker must exit after the upgrade handshake, so the DO needs a captured, serializable form of that context to perform key transformation itself.

### 3. Reconnection Must Be Transparent

Browsers drop WebSockets for many reasons: network changes, suspended tabs, or proxy timeouts. The client must automatically reconnect, re-subscribe to active keys, and re-fetch current state without the application noticing. At the same time, the client must not emit synthetic keepalive traffic, because such traffic would keep the DO awake and defeat the purpose of hibernation.

## The Solution

The design splits work between the Worker and a Durable Object. The Worker performs one-time work at upgrade time: it authenticates the request, resolves the room name, and extracts a serializable identity from the request context. It then hands the browser's WebSocket directly to the Durable Object and exits. The Durable Object owns the socket, room state, subscriptions, key transformation, and broadcasts. Because the DO has the captured identity and never needs request context, it can use Cloudflare's Hibernation WebSocket API and sleep between messages.

State is persisted to Durable Object storage, and subscriptions are stored in the WebSocket attachment so they survive hibernation.

## Worker Responsibilities

The hibernation route in `sdk/src/use-synced-state/hibernation/worker.mts` accepts browser WebSocket upgrades at `/__synced-state`. It resolves the room name using the registered room handler with the current request context. This is a one-time routing decision: the handler may inspect session data, query the database, or apply scoping rules before returning the final DO room name.

Once the room is resolved, the Worker extracts a serializable identity from the request context using the registered identity extractor. This identity must contain everything the Durable Object needs to transform keys or perform other request-scoped work. The Worker forwards the upgrade request to the hibernation Durable Object, passing the captured identity in the URL, and returns the DO's 101 response directly. After the upgrade response is returned, the Worker exits. It does not stay alive for the connection and does not proxy messages.

## Durable Object Responsibilities

`SyncedStateServer` in `sdk/src/use-synced-state/hibernation/server.mts` owns the WebSocket after the handoff. In `fetch` it creates a `WebSocketPair`, reads the identity from the request URL, stores it in the socket attachment, accepts the server socket with `acceptWebSocket`, and returns the client socket to the browser.

The DO stores state by transformed storage key and broadcasts updates to subscribers using the user-facing key. State is persisted to Durable Object storage on every `setState`, and the in-memory cache is warmed lazily on first read. Subscriptions are tracked per storage key in memory and persisted in the WebSocket attachment. On every `webSocketMessage`, the DO rehydrates subscriptions from the attachment so broadcasts continue to work after hibernation.

When a message arrives, the DO transforms the user-facing key internally by calling the registered key handler with the captured identity. This keeps scoping logic centralized while removing the need for a Worker proxy. If no key handler is registered, keys pass through unchanged.

## Client Hook Responsibilities

The client core in `sdk/src/use-synced-state/hibernation/client-core.ts` maintains one WebSocket connection per endpoint. It exposes `getState`, `setState`, `subscribe`, and `unsubscribe` methods to application hooks. It tracks active subscriptions in a module-scoped set, reconnects with exponential backoff when the connection drops, and re-subscribes to every active key after reconnecting. It notifies listeners of connection status changes: `connected`, `disconnected`, and `reconnecting`.

The client does not send application-level ping/pong traffic, because synthetic keepalives would keep the DO awake and defeat the purpose of hibernation. Instead it relies on a read-only dead-connection timer: if no message is received within a timeout window, the client force-closes the socket and triggers reconnect.

## Data Flow

A component calls `useSyncedState(initialValue, key, roomId?)` from `rwsdk/use-synced-state/hibernation/client`. The browser opens a WebSocket to `/__synced-state`. The Worker resolves the room and extracts a serializable identity from the request context. The Worker forwards the upgrade to the hibernation DO and exits. The DO stores the identity on the WebSocket attachment and accepts the socket.

The hook sends `subscribe` and `getState` messages for the requested key. The DO transforms the key via the registered key handler using the captured identity, persists the subscription, reads state from storage, and returns the value. When any client or server caller sends `setState`, the DO updates storage, broadcasts an `update` message to all subscribers, and includes the user-facing key. Each subscriber hook updates its local React state, keeping the UI in sync.

## Protocol

Messages are JSON envelopes with a protocol version and a `kind` discriminator:

```ts
{ v: 1, kind: "setState", key: "counter", value: 1, id: "abc" }
```

Client message kinds are `getState`, `setState`, `subscribe`, and `unsubscribe`. Server message kinds are `getState`, `setState`, `subscribe`, `unsubscribe`, `update`, and `error`. The protocol is intentionally simple and does not support chunked streaming, because the payloads are small key/value operations.

## Identity Extraction and Key Transformation

Applications register an identity extractor with `SyncedStateServer.registerIdentityExtractor`. It runs in the Worker at upgrade time and returns a serializable value from `requestInfo`:

```ts
SyncedStateServer.registerIdentityExtractor((requestInfo) => ({
  userId: requestInfo.ctx.user.id,
}));
```

The DO receives this identity, stores it on the WebSocket attachment, and passes it to handlers. The key handler signature is:

```ts
SyncedStateServer.registerKeyHandler(
  async (key, identity, stub) => `user:${identity.userId}:${key}`,
);
```

This approach keeps scoping logic in one place while allowing the Worker to exit after the upgrade. When no key handler is registered, keys pass through unchanged.

## Failure Handling

If the Worker cannot reach the DO, it returns a non-101 response and the browser connection fails. If the DO receives an unsupported protocol version or an invalid message shape, it sends an `error` message to that socket. When the browser socket closes, the DO removes it from subscription sets; reconnection is handled by the client core.

The client tracks the last incoming message timestamp. If no message is received for a timeout period, it assumes the socket is silently dead and force-closes it to trigger reconnection. Pending requests in flight during a close are rejected; mutations sent while disconnected are queued and sent on reconnect.

## Testing

Unit tests in `sdk/src/use-synced-state/hibernation/__tests__/server.test.mts` cover state persistence, subscription rehydration, protocol validation, DO eviction, key transformation, and identity passing. A dedicated playground in `playground/use-synced-state-hibernation` exercises the transport end-to-end.
