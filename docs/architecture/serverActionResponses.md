# Server Action Responses and Client-Side Redirects

RedwoodSDK allows React Server Functions (Server Actions) to return standard `Response` objects, such as redirects or custom responses with specific headers. This document explains how these responses are handled, serialized, and interpreted on the client.

## The Challenge: Non-Serializable Action Results

In React Server Components, server actions are expected to return serializable data that can be embedded in an RSC payload. However, a standard Web API `Response` object is not serializable.

## The Solution: A Serialized Response Abstraction

RedwoodSDK solves this by normalizing any `Response` object returned from a server action into a generic, serializable JSON abstraction before it is sent to the client.

## Wrapper Contract (`serverQuery`/`serverAction`)

At the server-wrapper layer, `serverQuery` and `serverAction` treat `Response` values as short-circuits by throwing them. This is intentional:

1. The wrapper throws the `Response`.
2. `rscActionHandler` catches thrown `Response` values and returns them as action results.
3. The worker normalizes that `Response` into `__rw_action_response`.
4. The client receives metadata and only auto-redirects for `3xx` responses with a `location` header.

This contract lets server code use `return Response...` or `throw Response...` patterns while keeping client behavior centralized and consistent.

### 1. Server-Side Normalization

When a server action completes, the framework checks if the result is an instance of `Response`. If it is, it converts it into a special object wrapper.

The framework then converts the response:

```typescript
// Simplified normalization logic in the worker
const normalizeActionResult = (result: any) => {
  if (result instanceof Response) {
    return {
      __rw_action_response: {
        status: result.status,
        statusText: result.statusText,
        headers: Object.fromEntries(result.headers),
      },
    };
  }
  return result;
};
```

This `__rw_action_response` object is then safely embedded in the RSC payload and streamed to the client.

### 2. Client-Side Interpretation

On the client, the transport layer receives the RSC payload and materializes the action result. Before returning the result to the caller, the framework checks if the result contains the `__rw_action_response` abstraction using the `isActionResponse` helper.

If a response abstraction is found with a [3xx redirect status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Redirections) and a `location` header, the framework automatically performs the redirect using `window.location.href`.

### 3. Interception (`onActionResponse`)

To provide developers with flexibility, `initClient` accepts an optional `onActionResponse` callback. This hook is fired whenever a response abstraction is found in an action result. Return `true` to signal that the response has been handled and default behavior (e.g. redirects) should be skipped.

```typescript
initClient({
  onActionResponse: (actionResponse) => {
    console.log("Action returned response with status:", actionResponse.status);
    // Return true to prevent the default redirect behavior
    // return true;
  },
});
```

## Key Benefits

- **Consistency:** Server actions can use the same standard `Response` API used elsewhere in the worker.
- **Simplicity:** Redirects "just work" from server actions without any additional configuration.
- **Control:** Developers can intercept action responses to customize behavior when needed.
