## RedwoodSDK v1.0.0-beta.0

This is the first beta release of RedwoodSDK v1.0.0. This release includes numerous changes and improvements made during the alpha phase.

For users upgrading from a `0.x` version, a migration guide is available to detail the required steps and optional changes.

**Migration Guide:** https://docs.rwsdk.com/getting-started/migrating

### Notable Changes

*   **Unified Starter Template**: The `standard` and `minimal` starters have been replaced by a single, unified `starter`. Authentication is now provided via an optional, co-located Passkey addon, ensuring it is versioned and tested with the core SDK.
*   **Peer Dependency Model**: Core dependencies such as `react`, `wrangler`, and `@cloudflare/vite-plugin` are now `peerDependencies`. This gives projects explicit control over their versions. See the migration guide for packages to add to `package.json`.
*   **Unified Request Handling**: RSC Action requests now pass through the global middleware pipeline, consistent with page requests. The `isAction` flag is available in the `requestInfo` object to conditionally apply logic.
*   **Streaming and Hydration**: The server-side rendering architecture was updated to ensure `useId` generates deterministic IDs, preventing hydration mismatches. The change also supports early hydration for Suspense-aware applications by interleaving the document and application streams.
*   **Import from 'use client' Modules**: It is now possible to import non-component exports (e.g., utility functions, constants) from a module marked with a `"use client"` directive into a server environment. This improves compatibility with libraries that co-locate components and other exports.
*   **Playground and UI Library Examples**: The repository now includes a `playground` directory with examples and end-to-end tests for both development and deployment environments. This showcases framework features and validates support for UI libraries like shadcn/ui (Radix), Base UI, and Chakra UI.

**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v0.3.12...v1.0.0-beta.0
