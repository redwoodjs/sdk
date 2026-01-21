---
title: Implementing Open-DO V1
date: 2026-01-20
author: Antigravity
---

# Implementing Open-DO V1

## Summary
Designed and implemented a local "Durable Objects" inspired registry for Bun. This implementation provides stateful, serial processing of requests mapped to specific IDs, along with automatic memory management through hibernation.

## The Problem
Standard workers/handlers in Node/Bun process requests in parallel, which can lead to race conditions when managing shared state without a database. The goal was to create a "Single-Point-of-Contact" (The Hub) that ensures requests for a specific ID are processed sequentially by the same instance.

## Investigation & Timeline
* **Initial State:** Created the `openDO` directory and initialized a TypeScript project.
* **Attempts:** 
    * Implemented the Mailbox pattern in the `OpenDO` base class using a `Promise` queue:
    ```typescript
    async fetch(request: Request): Promise<Response> {
      return (this.queue = this.queue.then(async () => {
        return await this.handleRequest(request);
      }));
    }
    ```
    * Built the `OpenDORegistry` to manage instances and handle "hibernation" by deleting idle instances after a timeout.
    * Integrated with the `pnpm` workspace to ensure proper dependency resolution.
    * Fixed a testing issue where `vi.advanceTimeBy` was used instead of the correct Vitest API `vi.advanceTimersByTime`.

## Discovery & Key Findings
* **Bun Compatibility:** Ensuring `bun-types` and proper `tsconfig` settings were crucial for a "Bun-only" implementation.
* **Serial Execution:** Chaining `Promises` is an elegant way to enforce serial execution without complex locking mechanisms.

## Resolution
The implementation allows developers to define stateful objects that process requests one by one. 
```typescript
class CounterDO extends OpenDO {
  count = 0;
  async handleRequest(request: Request) {
    this.count++;
    return new Response(this.count.toString());
  }
}
```
All features were verified with Vitest, confirming both serial execution and hibernation logic.

## Next Steps
- [ ] Add persistence layer (optional, for true "Durable" objects)
- [ ] Implement cross-instance communication
- [ ] Add formal documentation to the SDK docs
