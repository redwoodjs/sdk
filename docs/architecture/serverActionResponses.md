# Server Action Responses and Client-Side Redirects

RedwoodSDK allows React Server Functions (Server Actions) to return standard `Response` objects, such as redirects or custom responses with specific headers. This document explains how these responses are handled, serialized, and interpreted on the client.

## The Challenge: Non-Serializable Action Results

In React Server Components, server actions are expected to return serializable data that can be embedded in an RSC payload. However, a standard Web API `Response` object is not serializable.

## The Solution: A Serialized Response Abstraction

RedwoodSDK solves this by normalizing any `Response` object returned from a server action into a generic, serializable JSON abstraction before it is sent to the client.

### 1. Server-Side Normalization

When a server action completes, the framework checks if the result is an instance of `Response`. If it is, it converts it into a special object wrapper.

> **Note on `Response.redirect()`**: In development environments (running on Node.js), `Response.redirect()` requires an absolute URL. When using redirects in server actions, it is recommended to resolve relative paths against the current request URL:
>
> ```typescript
> import { requestInfo } from "rwsdk/worker";
>
> export async function myAction() {
>   const { request } = requestInfo;
>   const url = new URL("/success", request.url);
>   return Response.redirect(url.href, 302);
> }
> ```

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

If a response abstraction is found, the framework "interprets" it to see if it represents a redirect (e.g., status codes 301, 302, etc., with a `Location` header).

### 3. Interception and Custom Handling (`onActionResponse`)

To provide developers with flexibility, `initClient` accepts an optional `onActionResponse` callback. This hook is fired whenever a response abstraction is found in an action result, allowing for custom logging, telemetry, or overriding the default redirect behavior.

```typescript
initClient({
  onActionResponse: (ctx) => {
    if (ctx.redirect.kind === "redirect") {
      console.log("Action redirected to:", ctx.redirect.url);
      // Return true to prevent the default window.location.href redirect
      // return true;
    }
  },
});
```

### 4. Default Behavior: Automatic Redirects

If no hook is provided, or if the hook returns `false`/`void`, the framework performs the redirect automatically using `window.location.href`. This ensures that `Response.redirect()` "just works" from server actions while still being efficient and interceptable.

## Key Benefits

- **Consistency:** Server actions can use the same standard `Response` API used elsewhere in the worker.
- **Efficiency:** The transport layer only performs extra work (interpretation) when a response abstraction is explicitly detected.
- **Control:** Developers can intercept and customize how action-level redirects and responses are handled without modifying core SDK logic.
- **Custom Navigation:** By handling redirects on the client via JavaScript, the application has the opportunity to perform custom transitions or maintain state instead of defaulting to a standard browser-level navigation.
