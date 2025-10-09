# 2025-10-09: Add defineLinks Documentation

## Problem

The `defineLinks` function is a useful utility for creating type-safe links, but it is not documented. This makes it hard for users to discover and understand its purpose.

## Plan

1.  Create a new section in `docs/src/content/docs/core/routing.mdx` called "Generating Links".
2.  Explain the purpose of `defineLinks`: centralized route definition, type safety, and dynamic parameter handling.
3.  Include code examples for each of these points.
4.  Add an API reference for `defineLinks` within the new section.
5.  Keep the style consistent with the rest of the document.
6.  Update the API reference to be more descriptive, following the style of `renderToStream` in `react-server-components.mdx`.
7.  Move the "Generating Links" section to the end of the document.

## Create Conditional Router Entry Points

### Problem

The `rwsdk/router` module includes server-side routing logic that is unnecessary in the client bundle. We need to provide a client-specific entry point that only exports `defineLinks` to reduce bundle size.

### Plan

1.  Create a client-specific entry point for the router at `sdk/src/runtime/entries/routerClient.ts` that only exports `defineLinks`.
2.  Update `sdk/package.json` to:
    -   Add the new client entry point to the `tsup` build configuration.
    -   Modify the `exports` map for `"./router"` to use conditional exports. The `workerd` condition will point to the full router, and the `default` condition will point to the client-specific bundle.
3.  Update `sdk/src/vite/configPlugin.mts` to add `"rwsdk/router"` to the `optimizeDeps.include` list for the client build configuration.
