---
title: Durable Object Storage Improvements
date: 2026-01-21
author: Antigravity
---

# Durable Object Storage Improvements

## Summary
In this session, we significantly expanded the `open-do` storage capabilities to align with Cloudflare's Durable Object Storage API. We implemented persistent Alarms, atomic Transactions, advanced `list()` pagination, and improved the API ergonomics by adding `this.ctx` and `this.storage` to the base class.

## The Problem
The initial implementation of `open-do` was missing several critical storage features required for production-like Durable Object behavior:
- Lack of Alarms for scheduled background work.
- No transaction support for atomic multi-key updates.
- Limited `list()` support (missing `startAfter`).
- Inconsistent API compared to newer Cloudflare `DurableObject` class patterns (missing `ctx` and `storage` getters).

## Investigation & Timeline
* **Initial State:** `open-do` had basic KV and SQL support but lacked lifecycle and consistency features.
* **Storage Interface Update:** Updated `open-do.ts` to include `deleteAll()`, `getAlarm()`, `setAlarm()`, `deleteAlarm()`, `sync()`, and `transaction()`.
* **Implementation:**
    * **SQLite Persistence:** Added an `_alarms` table to the per-instance SQLite databases.
    * **Transactions:** Implemented using SQLite `BEGIN/COMMIT/ROLLBACK`.
    * **Alarms:** Added a scheduler loop in `OpenDORegistry` that periodically checks stored alarms and triggers the `alarm()` handler on instances.
* **Ergonomics:** Introduced `this.ctx` (alias for `this.state`) and `this.storage` (shorthand for `this.state.storage`) in the `OpenDO` base class.

## Discovery & Key Findings
* SQLite's `PRAGMA page_count` and `page_size` provide an easy way to implement the `databaseSize` property required by the CF SQL API.
* Using `BigInt` for timestamps in SQLite is necessary to handle millisecond precision correctly across runtimes.
* Adding a base `alarm()` method in the `OpenDO` class (even if optional) improved type safety for the scheduler logic.

## Resolution
The final solution includes a robust, persistent storage layer that passes all compatibility tests.

**Ergonomic usage:**
```typescript
class MyDO extends OpenDO {
  async fetch(request: Request) {
    // Cleaner API
    await this.storage.put("last_seen", Date.now());
    await this.storage.setAlarm(Date.now() + 10000);
    return new Response("OK");
  }

  async alarm() {
    // Automatically triggered
    const data = await this.storage.get("last_seen");
    console.log("Processing batch...", data);
  }
}
```

## Next Steps
- [ ] Implement `blockConcurrencyWhile` full functionality (currently a stub).
- [ ] Add support for `waitUntil` to extend object lifetime.
- [ ] Explore WebSocket hibernation support.
