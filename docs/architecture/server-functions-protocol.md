# RSC Server Functions & Data-Only Requests

## Why use `serverQuery` and `serverAction`?

Standard React Server Action calls typically expect the server to return the entire updated UI tree so the client can rehydrate the page. For many interactions—especially queries where you only need the returned data—this is unnecessary overhead.

`serverQuery` and `serverAction` allow you to call server-side functions and receive only the returned data, without triggering a full page re-render or transporting the entire UI tree back to the client.

## Overview

When calling a Server Function (via `serverQuery` or `serverAction`) in `rwsdk`, we use the **RSC protocol** with an optimization called `x-rsc-data-only`.

## The Request

The client sends a request (GET for queries, POST for actions) with:
- `__rsc`: Triggers the RSC handler.
- `__rsc_action_id`: Identifies the specific function to run.
- `x-rsc-data-only: true`: A special header telling the server to skip rendering the full React component tree. **Note: This is only sent for `serverQuery` calls.**

## The Payload Structure

The server returns a specialized RSC payload for data-only requests:
```json
{
  "node": [null, ["$","div",null,{"id":"rwsdk-app-end"}]],
  "actionResult": "Result from server function..."
}
```

### 1. `node: null` (Queries only)
For `serverQuery` (data-only) requests, we return `null` as the root node. This prevents the server from executing `Page` components and associated data fetching. For `serverAction` requests, the full UI tree is returned.

### 2. `div#rwsdk-app-end`
This is a required marker for `rwsdk`'s stream stitching logic.

### 3. `actionResult`
This is the actual data returned by your server function.

## Client-Side Handling

On the client, `rwsdk` handles this based on the source of the request:

1.  **Result Retrieval**: `createFromFetch` processes the stream and returns a promise that resolves to the `actionResult`.
2.  **UI Preservation vs Refresh**:
    - **`serverQuery`**: The `rwsdk` client runtime knows **not** to refresh the visual UI. This preserves existing page state while giving you the new data.
    - **`serverAction`**: The client runtime **will** refresh the UI with the new tree from the server. This allows for data mutations to be reflected in the UI immediately.

## Hydration and Re-rendering

- **`serverQuery`**: These requests **do not** cause the page to hydrate or re-render.
- **`serverAction`**: These requests **do** cause the page to hydrate and re-render the UI tree returned from the server.

We control this in `sdk/sdk/src/runtime/client/client.tsx`:

```tsx
// Inside fetchCallServer in client.tsx
if (source === "navigation" || source === "action") {
  transportContext.setRscPayload(streamData);
}
```
