---
title: Implementing WebSocket Support
date: 2026-01-21
author: Antigravity
---

# Implementing WebSocket Support

## Summary
We implemented `acceptWebSocket` and `getWebSockets` in `open-do` to track and manage WebSocket connections, enabling broadcast functionality in alignment with Cloudflare's Durable Object API.

## The Problem
`open-do` lacked WebSocket support, preventing real-time features and broadcasting, which are core capabilities of Durable Objects. Specifically, the `DurableObjectState` interface was missing `acceptWebSocket` and `getWebSockets`, meaning developers had no way to track active connections or send messages to groups of clients.

## Investigation & Timeline
* **Initial State:** 
    * `DurableObjectState` interface in `open-do.ts` was missing WebSocket methods.
    * `registry.ts` had no mechanism to track active sockets.
    * `matrix.md` listed WebSocket support as "Not Implemented".

* **Attempts:** 
    * We analyzed `registry.ts` and `open-do.ts` to determine where to store socket state.
    * We chose to implement an in-memory `Set` in `DurableObjectStateImpl` to track `{ ws, tags }` structure.
    * We updated the interface and added the implementation.
    * We created a test suite `src/websockets.test.ts` to verify the behavior.

## Discovery & Key Findings
* **WebSocket API**: Cloudflare's API relies on `state.acceptWebSocket(ws, tags)` to track sockets.
* **Auto-cleanup**: We need to listen to `close` and `error` events on the WebSocket to prevent memory leaks in our registry by removing them from the tracking set.
* **Tagging**: The tagging system is essential for the Broadcast pattern (sending to all sockets with a specific tag).

## Resolution
We successfully implemented the WebSocket tracking logic.

1.  **Interface Update**: Added methods to `DurableObjectState`.
2.  **Implementation**: Added `acceptWebSocket` and `getWebSockets` to `DurableObjectStateImpl`.
3.  **Verification**: Added `websockets.test.ts` to verify tracking, filtering by tags, and cleanup.
4.  **Documentation**: Updated `docs/matrix.md` to mark Broadcast as "Implemented" and WebSocket Hibernation as "Partial".

## Next Steps
- [ ] **Improved Hibernation**
      Better memory management for inactive objects. Dynamically unload inactive objects from memory after inactivity.
      Importance: 5
      Reference: [Cloudflare Hibernation API](https://developers.cloudflare.com/durable-objects/api/hibernation-api/)
- [ ] **WebSocket Hibernation**
      Support transferring and managing WebSockets across process restarts (simulated).
      Importance: 3
