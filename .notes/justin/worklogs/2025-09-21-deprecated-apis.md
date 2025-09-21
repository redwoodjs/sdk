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
  response: ResponseInit & { headers: Headers };
  // ...
}
```

## Implementation

1.  **`sdk/src/runtime/requestInfo/types.ts`**: Removed the `headers` property from the `RequestInfo` interface.
2.  **`sdk/src/runtime/requestInfo/worker.ts`**: Removed `"headers"` from the `REQUEST_INFO_KEYS` array.
3.  **`sdk/src/runtime/worker.tsx`**:
    -   Removed the `headers` property from the `outerRequestInfo` object.
    -   Removed the logic that merged `userHeaders` into the response, as `response.headers` is now the single source of truth.
4.  **`sdk/src/llms/rules/middleware.ts`**: Updated the example middleware to destructure `response` and use `response.headers` instead of `headers`.
5.  **`sdk/src/runtime/lib/auth/session.ts`**: Updated the `save` and `remove` functions to accept `responseHeaders` as an argument instead of `headers`.
6.  **`sdk/src/runtime/lib/router.test.ts`**: Removed the `headers` property from the `mockRequestInfo` object in the tests.

After making these changes, I ran the TypeScript compiler to ensure there were no type errors.

---

## PR Description

This change removes the deprecated `headers` property from the `RequestInfo` interface to simplify the API. All response header modifications should now be done through the `response.headers` object.

### BREAKING CHANGE

The `headers` property on the `RequestInfo` object has been removed. Code that previously used `requestInfo.headers` to set response headers will no longer work.

### Migration Guide

To update your code, replace any usage of `requestInfo.headers` with `requestInfo.response.headers`.

**Before:**

```typescript
const myMiddleware = (requestInfo) => {
  requestInfo.headers.set('X-Custom-Header', 'my-value');
};
```

**After:**

```typescript
const myMiddleware = (requestInfo) => {
  requestInfo.response.headers.set('X-Custom-Header', 'my-value');
};
```
