# Decision: use a purpose-built hibernation protocol for `useSyncedState`

## Decision

We will replace capnweb with a lightweight, purpose-built state-sync protocol directly on the Cloudflare Durable Object Hibernation API for `useSyncedState`.

## Context

PRZM-204 needs to stop idle `useSyncedState` WebSocket connections from keeping the Durable Object active and generating billable duration. The two candidate approaches were:

1. Build a custom `RpcTransport` adapter so capnweb runs on the Hibernation API.
2. Replace capnweb with a custom JSON protocol over raw WebSockets.

## Alternatives considered

### Option A: capnweb transport adapter

This would keep capnweb's RPC semantics by bridging `webSocketMessage`/`webSocketClose` events to capnweb's pull-based `RpcTransport.receive()`.

Rejected because:

- capnweb's `WebSocketTransport` uses `server.accept()` and in-memory event listeners, which pin the isolate and prevent hibernation.
- `RpcSessionImpl` keeps non-serializable state (export/import tables, stubs, callbacks, pending promises) that is destroyed when the DO isolate is evicted.
- Most importantly, the Workers runtime does not support hibernation of `RpcTarget` objects. The current `SyncedStateServer` exposes an `RpcTarget` (`CoordinatorApi`) and stores outbound subscriber callback stubs. Those stubs cannot survive isolate reconstruction, so the DO cannot hibernate.
- The capnweb maintainer and `cloudflare/workerd#6087` both say the real fix is runtime-level support for hibernatable RPC stubs, which does not exist today.

### Option B: custom hibernation protocol

The client opens a raw WebSocket to the DO and exchanges small JSON messages for `getState`, `setState`, `subscribe`, and `unsubscribe`. The DO uses `state.acceptWebSocket(server)`, handles `webSocketMessage` and `webSocketClose`, and broadcasts with `state.getWebSockets()`.

Chosen because:

- It maps directly onto the Hibernation API lifecycle.
- It avoids `RpcTarget`s and outbound stubs entirely, so nothing blocks DO hibernation.
- `useSyncedState` only needs the four operations above; capnweb's advanced RPC features are unused.
- The SDK already has a working reference implementation in `RealtimeDurableObject`.
- It removes the capnweb dependency for apps that only use `useSyncedState`, shrinking the client bundle.

## Consequences

- The public `useSyncedState` hook API will remain unchanged.
- `client-core.ts`, `SyncedStateServer.mts`, and `worker.mts` will be rewritten.
- We must solve subscription persistence across hibernation, likely via `serializeAttachment()` per socket or DO storage.
- We must preserve `registerKeyHandler` semantics. The handler runs in worker request context, so key transformation will stay on the worker side for HTTP/stub calls, and a scoped context or prefix will be passed to the DO for WebSocket messages.
- Hibernation behavior cannot be fully reproduced in local dev (workerd never evicts the DO in Miniflare), so validation will need a deployed environment.

## Worklog reference

`~/notes/rw/sdk/worklogs/2026-06-18-use-synced-state-hibernation-option-evaluation.md`
