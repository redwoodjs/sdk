---
title: Open-DO SQLite Persistence & SQL API
date: 2026-01-21
author: Antigravity
---

# Open-DO SQLite Persistence & SQL API

## Summary
Implemented a persistent storage layer for `open-do` that supports both standard Key-Value (KV) storage and a native SQLite SQL API. The implementation follows a "one SQLite file per Durable Object" model, providing strict isolation and matching Cloudflare's DO architecture.

## The Problem
`open-do` previously relied on an `InMemoryStorage` implementation, meaning all state was lost when the process restarted. We needed a persistent backend that:
1. Used **no 3rd party libraries** (strictly built-in runtime modules).
2. Supported both **KV storage** (`get/put`) and **Structured SQL** (`storage.sql`).
3. Worked across **Bun** (`bun:sqlite`) and **Node.js** (`node:sqlite`).

## Investigation & Timeline
* **Initial State:** Only `InMemoryStorage` existed; files were already renamed to kebab-case.
* **Attempts:** 
    * Proposed a unique database per DO to prevent write contention and simplify deletion.
    * Research confirmed Node.js 22.5+ has `node:sqlite` but requires the `--experimental-sqlite` flag.
    * Implemented `SqliteStorage` which uses a reserved `_kv` table for standard KV methods and exposes the rest of the database via the `sql` API.
    * Encountered issues with Vitest not propagating experimental flags to workers; fixed by creating a `vitest.config.ts` using the `forks` pool.
    * Encountered ESM resolution issues with `node:sqlite` in Vite; fixed by using `createRequire` to load the native module directly.
    * Wrapped native drivers to support the Cloudflare-style fluent `.bind()` API:
    ```typescript
    this.state.storage.sql.prepare("INSERT INTO users (name) VALUES (?)").bind("Alice").run();
    ```

## Discovery & Key Findings
* **Fluent API Mapping:** Neither Bun nor Node's native SQLite drivers support a `.bind()` method that returns the statement object for chaining. We had to implement a wrapper that buffers bindings and applies them during execution.
* **Cross-Runtime Serialization:** Since `Bun.serialize` is only available in Bun, we implemented a fallback to `node:v8.serialize` for Node.js environments to ensure complex JS objects (Dates, nested objects) persist correctly.

## Resolution
Modified `registry.ts` to include `SqliteStorage` and updated `OpenDORegistry` to accept a `storageDir` option. If provided, paths are resolved relative to the CWD and database files are created automatically.

## Next Steps
- [ ] **Implement Hibernate Logic**: Dynamically unload inactive objects from memory after inactivity to manage system resources, matching the [Cloudflare Durable Object lifecycle](https://developers.cloudflare.com/durable-objects/api/hibernation-api/).
- [ ] **Implement `blockConcurrencyWhile`**: Support long-running migration or setup tasks by pausing incoming requests, ensuring state consistency as defined in the [Durable Object Storage API](https://developers.cloudflare.com/durable-objects/api/storage-api/#blockconcurrencywhile).
- [ ] **Full `list()` Cursor Support**: Expand the `list()` options to include `startAfter` for efficient cursor-based pagination, moving away from simple SQL `OFFSET` to better mirror Cloudflare's performance characteristics.
