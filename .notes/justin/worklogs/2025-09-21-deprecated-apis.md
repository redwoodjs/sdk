# Work Log: Deprecated APIs

**Date:** 2025-09-21

## Problem

Identify and document deprecated APIs within the SDK codebase to prepare for their eventual removal.

## Plan

1.  Search the codebase for `@deprecated` JSDoc annotations and other comments indicating deprecation.
2.  Document all findings in this work log.
3.  Create a plan for removing the deprecated APIs in a future release.

## Findings

A search for "deprecated" revealed the following deprecated API:

-   **`headers` property on `RequestInfo` interface**
    -   **Location:** `sdk/src/runtime/requestInfo/types.ts`
    -   **Details:** The `headers` property on the `RequestInfo` interface is marked as deprecated.
    -   **Recommended Replacement:** `response.headers` should be used instead.

```typescript
// sdk/src/runtime/requestInfo/types.ts

export interface RequestInfo<Params = any, AppContext = DefaultAppContext> {
  // ...
  /** @deprecated: Use `response.headers` instead */
  headers: Headers;
  // ...
  response: ResponseInit & { headers: Headers };
  // ...
}
```
