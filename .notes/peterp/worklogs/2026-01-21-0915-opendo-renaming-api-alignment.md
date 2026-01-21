---
title: OpenDO Rename and API Alignment
date: 2026-01-21
author: Antigravity
---

# OpenDO Rename and API Alignment

## Summary
Renamed the `openDO` implementation to `open-do` (kebab-case) and aligned the public API with Cloudflare's Durable Objects to ensure compatibility and standard developer experience.

## The Problem
The implementation used non-standard naming for directories (`openDO`) and a custom API for the base class (`constructor(id: string)` and `handleRequest(request: Request)`), which diverged from the Cloudflare Durable Object API.

## Investigation & Timeline
* **Initial State:** Directory named `openDO`, files used PascalCase (e.g., `OpenDO.ts`), and the API required users to override `handleRequest`.
* **Attempts:** 
    * Renamed workspace directory to `open-do`.
    * Renamed all source files to kebab-case (e.g., `open-do.ts`, `registry.ts`).
    * Updated `pnpm-workspace.yaml` to reflect the move.
    * Refactored `OpenDO` base class to accept `state` and `env` in the constructor.
    * Renamed the user-facing entry point from `handleRequest` to `fetch`.
    * Added `DurableObjectState` and `DurableObjectStorage` interfaces.
    * Updated `OpenDORegistry` to provide an `InMemoryStorage` implementation.

## Discovery & Key Findings
By providing a `DurableObjectState` object that includes a `storage` implementation, we can make the `open-do` environment feel identical to a Cloudflare Worker, allowing code to be easily ported or shared.

## Resolution
The implementation now supports a standard Cloudflare-style definition:

```typescript
class MyDO extends OpenDO {
  constructor(state: DurableObjectState, env: any) {
    super(state, env);
  }

  async fetch(request: Request) {
    await this.state.storage.put("key", "value");
    return new Response("OK");
  }
}
```

## Next Steps
- [ ] Implement actual hibernation (flushing memory to disk).
- [ ] Add support for persistent storage backends (e.g., D1, SQLite).
- [ ] Implement `blockConcurrencyWhile` logic.
