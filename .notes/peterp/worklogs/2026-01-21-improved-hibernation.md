---
title: Implementing Improved Durable Object Hibernation
date: 2026-01-21
author: Antigravity
---

# Implementing Improved Durable Object Hibernation

## Summary
We implemented a robust hibernation mechanism for Durable Objects in `open-do`. This feature automatically unloads inactive objects from memory to verify resource usage, while correctly handling active requests, `waitUntil` promises, and implementing Cloudflare's WebSocket Hibernation API.

## The Problem
Previously, `open-do` kept all instantiated Durable Objects in memory indefinitely, which is not scalable for long-running processes or high-cardinality standard objects. We needed a system to:
1.  Track activity of each object.
2.  Evict objects that have been idle for a configurable period.
3.  Support "Hibernatable WebSockets" — allowing an object to be unloaded even if it has open WebSockets, and automatically waking it up (re-instantiating it) when a message arrives.

## Investigation & Timeline
*   **Initial State:** The `OpenDORegistry` simply held a `Map<string, OpenDO>` with no concept of lifecycle management or eviction.
*   **Attempts & Implementation:**
    *   We refactored `OpenDORegistry` to map IDs to an `InstanceContainer` instead of the instance directly. The container manages usage metrics (`activeRequests`, `lastActive`, `waitUntilPromises`) and the eviction logic.
    *   We updated the `OpenDO` base class to include optional WebSocket lifecycle methods (`webSocketMessage`, `webSocketClose`, `webSocketError`).
    *   We implemented an eviction loop in the registry that checks `canEvict(timeout)` on containers.
*   **Debugging:**
    *   We encountered a race condition in the `getInstance` method during testing. The `loadingPromise` was being assigned via an IIFE (Immediately Invoked Function Expression).
    *   *Issue:* If the async function executed synchronously up to a failure or completion before yielding, the `finally` block (clearing the promise) could run before the promise was even assigned to the class property, or other timing issues could occur.
    *   *Fix:* We added `await Promise.resolve()` at the very start of the async loader to force it to yield to the event loop, ensuring the `this.#loadingPromise` assignment completes before any logic runs.

    ```typescript
    this.#loadingPromise = (async () => {
      await Promise.resolve(); // Ensure async execution
      try {
        // ... creation logic
      } finally {
        this.#loadingPromise = null;
      }
    })();
    ```

## Discovery & Key Findings
*   **Instance Containers:** Wrapping the DO instance in a container is essential for maintaining state (like WebSocket listeners and queue locks) even when the actual JS object is garbage collected.
*   **WebSocket Hijacking:** For hibernation to work, the "system" (our Container/Registry) must attach its own listeners to the WebSocket that persist across object evictions. When a message arrives, it triggers a wake-up.

## Resolution
The implementation is complete and verified with `hibernation.test.ts`.
*   Objects evict after timeout if idle.
*   `waitUntil` prevents eviction.
*   Standard WebSockets prevent eviction (unless the DO supports hibernation).
*   Hibernation-supported WebSockets allow eviction and trigger wake-up on messages.

## Next Steps
- [x] Implement Hibernation
- [ ] Integrate into the main `open-do` server entry point (ensure registry options are passed correctly).
