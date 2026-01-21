---
title: Implementing blockConcurrencyWhile
date: 2026-01-21
author: Antigravity
---

# Implementing blockConcurrencyWhile

## Summary
We implemented `blockConcurrencyWhile` for `open-do` to ensure that initialization or migration tasks can block subsequent requests, aligning with Cloudflare's Durable Object API.

## The Problem
The `blockConcurrencyWhile` method in `DurableObjectState` was a stub and didn't actually block anything. Additionally, the request serialization queue was an internal property of the `OpenDO` class, making it difficult for the state object to control the execution flow.

## Investigation & Timeline
* **Initial State:** 
    * `OpenDO` had a private `#queue` property to serialize `fetch` requests.
    * `DurableObjectState` was defined as an interface in `open-do.ts` and instantiated as a simple object literal in `registry.ts`.
    * `blockConcurrencyWhile` was implemented as `async (cb) => cb()`, providing no blocking behavior.

* **Attempts:**
    * We decided to move the queue ownership from `OpenDO` to `DurableObjectState`.
    * We created a concrete class `DurableObjectStateImpl` in `registry.ts` to hold the queue (`Promise.resolve()`) and the `blockConcurrencyWhile` logic.
    * We updated `OpenDO._internalFetch` to wrap the user's `fetch` call using `this.state.blockConcurrencyWhile(callback)`, ensuring all incoming requests join the same promise chain as any blocking tasks.

## Discovery & Key Findings
* **Queue Ownership:** To support `blockConcurrencyWhile` correctly, the state object (which exposes the API) must own the serialization mechanism, not the Durable Object instance itself.
* **Unified Chain:** By making `_internalFetch` use `blockConcurrencyWhile` internally, we simplify the logic: everything is just a task on the queue.

## Resolution
We implemented `DurableObjectStateImpl` in `registry.ts`:

```typescript
class DurableObjectStateImpl implements DurableObjectState {
  // ...
  #queue = Promise.resolve<any>(undefined);

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return (this.#queue = this.#queue.then(callback));
  }
}
```

And updated `OpenDO`:

```typescript
async _internalFetch(request: Request): Promise<Response> {
  return this.#state.blockConcurrencyWhile(async () => {
    return await this.fetch(request);
  });
}
```

We verified this with a new test case in `open-do.test.ts` where a constructor blocks concurrency for 100ms, ensuring subsequent fetches wait until initialization is complete.

## Next Steps
- [ ] Implement `transaction` support in `DurableObjectState` (currently a stub in some places or limited implementation).
- [ ] Continue filling out the Feature Matrix.
