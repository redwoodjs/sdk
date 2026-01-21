---
title: Implementing OpenDO RPC and Communication Layer
date: 2026-01-20
author: Antigravity
---

# Implementing OpenDO RPC and Communication Layer

## Summary
We implemented a communication layer for Durable Objects ("OpenDO") that enables an RPC-like experience. The final solution uses a custom binary envelope for high-performance messaging, a singleton registry with promise-based locking, and JavaScript Proxies to create transparent stubs.

## The Problem
The goal was to make Durable Objects feel like RPC in a Bun/Node environment. Key constraints included:
- Avoiding `JSON.stringify` on the hot path.
- Ensuring singleton behavior for specific IDs across the cluster.
- Handling requests serially per Object ID to prevent race conditions.
- Hiding binary serialization using stubs.

## Investigation & Timeline
* **Initial State:** We had a basic implementation of `OpenDO` and a registry, but they lacked robust singleton locking and a binary communication layer.
* **Key Transition:** Decided to use `capnweb` directly for serialization primitives but opted for a custom binary envelope to avoid JSON on the hot path.
* **Final Approach:** Implemented a manual binary `RpcEnvelope` using `Uint8Array` and `DataView` to wrap the arguments (serialized via `capnweb`).
    * **The "Why":** While `capnweb` handles complex RPC features, its default `serialize` method relies on `JSON.stringify` for the message structure. By utilizing a manual binary envelope for the `RpcEnvelope` (id, method, timestamp), we eliminate the overhead of parsing/stringifying JSON at the entry point of every request. This allows the registry and coordinator to verify method names and unique IDs using direct byte access, ensuring the "hot path" remains as fast as possible.
    * **Performance Note:** We very likely need to run performance tests against this repo to validate these optimizations and ensure that the binary overhead is indeed lower than the JSON alternative in a real-world Bun/Node environment.

## Discovery & Key Findings
- `capnweb.serialize()` in the current version produces JSON-like strings for arrays (e.g., `[[10]]` instead of `[10]`), which required adjusting test expectations.
- Promise-based locking in the `Registry` is critical to prevent duplicate instantiation when multiple requests hit a new ID simultaneously.

## Resolution
Defined the following core components:
- `Envelope.ts`: Custom binary encoder/decoder for `RpcEnvelope`.
- `Registry.ts`: singleton management with asynchronous locking.
- `OpenDO.ts`: Base class with private fields and serial fetch queue.
- `RPC.ts`: Proxy-based stubs for transparent cross-process calls.

## Next Steps
- [ ] Add an actual working "hello world example" to the tests, it should semantically be identical to durable objects.
- [ ] Implement hibernation logic in the new `Registry` structure.
- [ ] Explore Direct-TCP or Unix-Domain-Socket transports for the `Connection` interface.
- [ ] Integrate WebSockets as the "source of truth" for active connections.
