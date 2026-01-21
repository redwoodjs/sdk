---
title: Implement Full list() Cursor Support
date: 2026-01-21 21:49
author: peterp
---

# Implement Full list() Cursor Support

## Summary
We implemented the `startAfter` parameter for the `list()` storage API in both `SqliteStorage` and `InMemoryStorage`. This ensures full compatibility with Cloudflare's Durable Object Storage API, specifically enabling cleaner cursor-based pagination.

## The Problem
The existing `list()` implementation was missing `startAfter` and had bugs when `reverse: true` was used. Specifically, the comparison operators (e.g., `key >= start`) were hardcoded for ascending order. When a user requested a reversed list, the boundaries (`start`, `startAfter`, `end`) returned incorrect subsets because they didn't account for the flipped lexicographical direction.

## Investigation & Timeline
* **Initial State:** `list()` only supported `start`, `end`, `prefix`, `limit`, and `reverse`, but used fixed comparison logic.
* **Reproduction:** Created `open-do/src/list.test.ts` to verify the behavior of `reverse: true`.
```typescript
// Reproduction snippet
const listDesc = await myDo.storage.list({ startAfter: "c", reverse: true });
// Expected: ["b", "a"]
// Actual (before fix): ["e", "d"]
```
* **Attempts:**
    * Researched Cloudflare documentation for `startAfter` behavior.
    * Identified that `reverse` must flip `>` to `<` and vice versa for boundary conditions.

## Discovery & Key Findings
In lexicographical storage, the "direction" of the search changes when you sort in reverse. 
- For `reverse: false`: `startAfter` means `key > value`.
- For `reverse: true`: `startAfter` means `key < value`.

## Resolution
Modified `open-do/src/registry.ts` to use conditional operators in both `SqliteStorage` and `InMemoryStorage`.

```diff
- wheres.push("key > ?");
+ wheres.push(reverse ? "key < ?" : "key > ?");
```

## Next Steps
- [x] Complete Feature Matrix Parity check
- [ ] Explore further `list()` optimizations for very large datasets
