## Solution

To resolve this, I'm making two changes:

1.  **Update `sdk/package.json`**: Update the `peerDependencies` ranges for the packages that are out of sync (`@cloudflare/vite-plugin` and `react` packages). The flexible version ranges for packages that are still compatible (`vite`, `wrangler`) are preserved.
2.  **Update `renovate.json`**: Add `sdk/package.json` to the `matchFileNames` of both rules that contribute to the `starter-peer-deps` group. This will ensure that Renovate updates the SDK's peer dependencies in the same PR as the starter and playground projects, keeping them in sync.

---

## PR Description

### chore(deps): sync peer dependency ranges with starter project

This change addresses a peer dependency resolution failure that occurs when `npm install` is run in test environments.

The `ERESOLVE` error was caused by a version mismatch for several peer dependencies. The versions used in the `starter` project (e.g., for `@cloudflare/vite-plugin` and the `react` canary) were no longer satisfied by the allowed `peerDependency` ranges specified in the `sdk/package.json`.

This happened because the Renovate configuration rules responsible for updating these peer dependencies did not include the SDK's `package.json`. Consequently, when Renovate updated these packages in the starter and playground projects, the SDK's `peerDependencies` were not updated, leading to the incompatibility.

This commit introduces two changes to resolve the issue:

1.  **Updates SDK Peer Dependency Ranges**: The `peerDependency` ranges in `sdk/package.json` for `@cloudflare/vite-plugin` and the `react` packages have been updated to be compatible with the latest versions used in the starter project. The existing flexible ranges for `vite` and `wrangler`, which were already compatible, have been preserved.

2.  **Updates Renovate Configuration**: The `renovate.json` file has been modified to include `sdk/package.json` in the `matchFileNames` for both `starter-peer-deps` rules (for React and non-React packages). This ensures that all of the SDK's `peerDependencies` will be updated in lockstep with the starter and playground projects in the future, preventing this issue from recurring.
