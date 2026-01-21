---
title: OpenDO Feature Matrix and Gap Analysis
date: 2026-01-21
author: Antigravity
---

# OpenDO Feature Matrix and Gap Analysis

## Summary
Created a comprehensive feature matrix comparing `open-do` to Cloudflare's Durable Object API. This involved researching Cloudflare's documentation for Storage, SQL, Alarms, and RPC APIs and mapping them to our current implementation to identify gaps and prioritize next steps.

## The Problem
The `docs/matrix.md` file was empty, and we lacked a clear source of truth for which Durable Object features were implemented, partially implemented, or missing. This made it difficult to plan future development and set user expectations.

## Investigation & Timeline
* **Initial State:** `docs/matrix.md` was a blank slate. The codebase included basic KV storage, a native SQL API for Bun/Node, and a Cap'n Web RPC layer.
* **Attempts:**
    * Researched Cloudflare DO documentation for all primary APIs.
    * Mapped current `open-do` implementations (e.g., `SqliteStorage`, `OpenDORegistry`, `createStub`) to these APIs.
    * Identified "importance" levels based on core DO functionality (persistence and coordination being highest).

## Discovery & Key Findings
* **Strong Foundation:** `open-do` already has robust KV and SQL support across Bun and Node.js.
* **RPC Alignment:** The Cap'n Web proxy stub is very close to the standard DO `getStub` pattern.
* **Gaps:** Alarms, WebSocket Hibernation, and explicit `storage.transaction()` are the primary missing features. Lifecycle methods like `blockConcurrencyWhile` and `waitUntil` are currently stubs.

## Resolution
Populated [matrix.md](file:///Users/peterp/gh/redwoodjs/sdk/open-do/docs/matrix.md) with a detailed categorization of features, code samples, and implementation statuses.

## Next Steps
- [ ] **Implement `storage.transaction()`**
      Provide a transactional API wrapper for KV operations to ensure atomicity.
- [ ] **Implement Alarms API**
      Add `setAlarm`, `getAlarm`, and `deleteAlarm` with a background worker to trigger the `alarm()` handler.
- [ ] **Implement WebSocket Hibernation**
      Support transferring and managing WebSockets across process restarts.
- [ ] **Fully implement `blockConcurrencyWhile`**
      Move from a stub to a working queue blocker during initialization/migrations.
