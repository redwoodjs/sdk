---
title: Implement waitUntil Support
date: 2026-01-21
author: Antigravity
---

# Implement waitUntil Support

## Summary
Successfully implemented `waitUntil` support in `open-do`. This allows Durable Objects to perform background tasks after returning a response, better aligning with the Cloudflare Durable Object API.

## The Problem
Durable Objects in `open-do` previously lacked a way to schedule work that should continue after the `fetch` method returns. This is essential for non-blocking side effects like logging, telemetry, or deferred database updates.

## Investigation & Timeline
* **Initial State:** `DurableObjectState.waitUntil` was a no-op stub in `registry.ts`.
* **Attempts:** 
    * Modified `OpenDO` base class to include a private `#waitUntilPromises` array.
    * Exposed an internal `_addWaitUntil` method for the registry to push background tasks.
    * Added `_waitForWaitUntil` to the base class to enable testing of background completion.
    * Refactored `OpenDORegistry` to capture the `instance` and route `state.waitUntil` calls to it.

```typescript
// registry.ts
let instance: T;
const state: DurableObjectState = {
  // ...
  waitUntil: (promise: Promise<any>) => {
    instance?._addWaitUntil(promise);
  },
};
instance = new Ctor(state, env);
```

## Discovery & Key Findings
We found that `_waitForWaitUntil` needs to handle nested `waitUntil` calls (where one background task adds another). We implemented this using a `while` loop that clears the promise array and awaits existing items until the queue is empty.

## Resolution
The implementation allows `waitUntil` to be called during or after the `fetch` execution. It does not block the HTTP response but ensures the object remains "active" (conceptually) until tasks finish. Verified with a new test suite covering basic, multiple, and nested `waitUntil` scenarios.

## Next Steps
- [ ] Mark `waitUntil` as complete in `tasks.md`
- [ ] Implement Hibernate Logic
- [ ] Fully Implement `blockConcurrencyWhile`
- [ ] WebSocket Hibernation
