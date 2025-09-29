## RedwoodSDK v1.0.0-beta.0

This is the first beta release of RedwoodSDK v1.0.0. This release includes numerous changes and improvements made during the alpha phase.

For users upgrading from a `0.x` version, a migration guide is available to detail the required steps and optional changes.

**Migration Guide:** https://docs.rwsdk.com/getting-started/migrating

### Notable Changes

*   **Peer Dependency Model**: Core dependencies such as `react`, `wrangler`, and `@cloudflare/vite-plugin` are now `peerDependencies`. This gives projects explicit control over their versions. See the migration guide for packages to add to `package.json`.
*   **Unified Request Handling**: RSC Action requests now pass through the global middleware pipeline, consistent with page requests. The `isAction` flag is available in the `requestInfo` object to conditionally apply logic.
*   **Streaming and Hydration**: The server-side rendering architecture was updated to ensure `useId` generates deterministic IDs, preventing hydration mismatches. The change also supports early hydration for Suspense-aware applications by interleaving the document and application streams.
*   **'use client' Module Support**: It is now possible to import non-component exports (e.g., utility functions, constants) from a module marked with a `"use client"` directive into a server environment. This improves compatibility with libraries that co-locate components and other exports.
*   **End-to-End Testing Framework**: A `playground` directory and an E2E testing framework have been added to the repository. This allows for isolated test projects to run against both a local dev server and a temporary Cloudflare deployment.
*   **Vite 7 Support**: The SDK and starters now support Vite v7.

### Full Changelog

A full list of changes can be found by reviewing the pull requests associated with the `v1.0.0-alpha` releases.
