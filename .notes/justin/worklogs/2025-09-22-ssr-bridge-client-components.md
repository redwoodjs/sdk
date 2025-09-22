# Work Log: 2025-09-22 - Bridging Client Components for SSR

## Problem

When a module containing a `"use client"` directive is processed in the `worker` (RSC) environment, its implementation is replaced entirely with client reference proxies. This is the correct behavior for the RSC rendering pass, which only needs to serialize a reference to the client component.

However, this creates a problem for the subsequent SSR pass. The SSR renderer, which is responsible for generating the initial HTML, also runs within the `worker` environment but operates on the RSC payload. It needs access to the *actual* component implementation to render it, but that implementation has been stripped out. This leaves the SSR pass unable to render client components, resulting in incomplete HTML.

## Idea

The proposed solution is to create a bridge that provides the SSR renderer with the necessary component code without disrupting the RSC module graph. This involves modifying the client component transformation process.

When a client component is transformed for the `worker` environment, the process will be updated:

1.  In addition to generating the client reference proxies, inject an import for an SSR-processed version of the same component module. This import will use the SSR Bridge's virtual module prefix (`virtual:rwsdk:ssr:/path/to/component`). This effectively loads the component's code as processed by the `ssr` Vite environment.
2.  Update the `registerClientReference` factory function to accept the imported SSR component module as an argument.
3.  The runtime can then associate the SSR component implementation with its corresponding client reference. During the SSR pass, it can retrieve and render the actual component instead of the proxy.

This approach connects the two environments at the module level, ensuring the SSR renderer has what it needs while maintaining a clean separation for the RSC pass.

## Implementation Plan

1.  **Update `transformClientComponents.mts`:**
    -   Modify the transform to inject a namespace import for the SSR version of the client component module, e.g., `import * as SSRModule from 'virtual:rwsdk:ssr:/path/to/component.tsx'`.
    -   Update the calls to `registerClientReference` to pass this `SSRModule` as a new argument. The `exportName` will be used to access the correct export from `SSRModule`.

2.  **Update `registerClientReference`:**
    -   Locate its definition in `sdk/src/runtime/register/worker.ts`.
    -   Modify its signature to accept the imported SSR module namespace (`SSRModule`) as the first argument.
    -   Update the implementation to extract the specific export from the `SSRModule` (e.g., `SSRModule[exportName]`). This exported value (the actual component) is then passed to `baseRegisterClientReference`. This ensures that the client reference proxy is created around the actual SSR component implementation.

3.  **Update SSR Runtime:**
    -   Verify that the existing SSR `renderToReadableStream` process correctly handles the updated client references. With the `SSRModule` passed to `baseRegisterClientReference`, React's internals should handle the component resolution automatically, likely requiring no changes to our SSR runtime code.

4.  **Update Tests:**
    -   Modify the tests in `transformClientComponents.test.mts` to reflect the new output of the transformation.
    -   If possible, add a test case to verify that the SSR runtime correctly renders the bridged component. This might require an end-to-end test.
