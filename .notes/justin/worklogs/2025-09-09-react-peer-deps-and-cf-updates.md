# 2025-09-09: React Peer Dependencies and Cloudflare Tooling Upgrade

## Problem

The initial goal was to transition the RedwoodSDK to a peer dependency model for React. This change is intended to give users control over React versions and resolve potential version mismatches with other libraries.

After implementing this change, a runtime error, `ReferenceError: WeakRef is not defined`, was discovered when running an application against the Cloudflare Workers environment. The error originates from the `react-server-dom-webpack` package, which now comes from the user's project dependencies.

## Investigation

1.  **Initial Analysis**: The `WeakRef` object is part of the ES2021 specification and is not supported by the default Cloudflare Workers runtime, causing the reference error.
2.  **Attempt 1 (Alias `server.edge.js` build)**: An investigation of the `react-server-dom-webpack` package revealed an `server.edge.js` build. The hypothesis was that this build would be compatible with edge environments and would not use `WeakRef`. An alias was added to the `reactConditionsResolverPlugin` to force Vite to use this build for the worker environment.
3.  **Correction**: Further inspection showed that the `server.edge.js` build *also* contains `WeakRef`. This invalidated the aliasing approach. The alias was a short-circuit to the resolver's conditional export logic and was removed in favor of letting `enhanced-resolve` handle it.
4.  **Attempt 2 (Compatibility Flag)**: Research uncovered that Cloudflare supports `WeakRef` via a compatibility flag. The fix was to add `"enable_weak_ref"` to the `compatibility_flags` in `wrangler.jsonc` and update the `compatibility_date`.
    -   [GitHub Issue: `WeakRef` not supported in `workerd`](https://github.com/cloudflare/workerd/issues/3053)
    -   [Changelog: Improved memory efficiency for WebAssembly Workers](https://developers.cloudflare.com/changelog/2025-05-08-finalization-registry/)
5.  **Correction**: After applying the flag and updating the `compatibility_date`, a warning from `wrangler` indicated that the `enable_weak_ref` flag is now enabled by default as of `2025-05-05`. The flag was therefore removed, and the solution is to ensure the `compatibility_date` is on or after this date.

## New Plan: Upgrade Cloudflare Dependencies

The root cause is now believed to be an outdated Cloudflare development environment. The new plan is to upgrade the core Cloudflare tooling, which is expected to provide a runtime that supports the features required by the latest React canary versions.

This involves a cascading series of changes:

1.  **Align `@cloudflare/vite-plugin` to Peer-Only Strategy**: Move `@cloudflare/vite-plugin` from a direct dependency of the SDK to a `peerDependency`.
2.  **Align `wrangler` to Peer-Only Strategy**: Since `@cloudflare/vite-plugin` lists `wrangler` as a peer dependency, we will also move `wrangler` to be a `peerDependency` of the SDK.
3.  **Update Starters**: Add the latest versions of `@cloudflare/vite-plugin` and `wrangler` as explicit `devDependencies` to the `minimal` and `standard` starter projects.

## Breaking Changes

-   **React Peer Dependency**: Users must now add `react`, `react-dom`, and `react-server-dom-webpack` as explicit dependencies to their project's `package.json`.
-   **Cloudflare Vite Plugin Peer Dependency**: Users must now add `@cloudflare/vite-plugin` as an explicit `devDependency` to their project's `package.json`.
-   **Wrangler Peer Dependency**: Users must now add `wrangler` as an explicit `devDependency` to their project's `package.json`.
