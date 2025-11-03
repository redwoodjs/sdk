# Widen React peer dependency range

## Problem

The current `peerDependency` range for React in `sdk/package.json` is too restrictive. It uses a specific canary version (`>=19.3.0-canary-4fdf7cf2-20251003`), which causes problems with `npm`. `npm` seems to have difficulty resolving newer canary versions against this range, preventing users from using them.

## Plan

1.  Update the `peerDependencies` for `react`, `react-dom`, and `react-server-dom-webpack` in `sdk/package.json` to `>19.3.0-0 <20.0.0`. This range will include all pre-releases of React 19.3.0 and later, up to version 20.
2.  Validate this change by creating a temporary playground project.
3.  This playground will use a newer React canary version to confirm that `pnpm install` works as expected with the updated `peerDependency` range.
4.  Run the tests for the playground to ensure everything is functional.
5.  Remove the temporary playground once validation is complete.

## Renovate Configuration

The `renovate.json` configuration was updated to prevent automatic updates of `peerDependencies` in `sdk/package.json`.

### Reasoning

Bumping the minimum version of a `peerDependency` in the SDK is a breaking change for users on an older version of that dependency. When they update the SDK, they would be forced to upgrade their other tools, which is not the desired behavior for a minor SDK update.

To maintain a wide and stable compatibility range, Renovate has been configured to ignore `peerDependencies` for both React and other tools (like `wrangler` and `vite`) within `sdk/package.json`.

Renovate will continue to update the dependencies in the starter and playground projects to the latest versions, which is useful for continuous integration and testing against the latest releases.

---

## PR Description

### Problem

The SDK's `peerDependencies` for React were previously being updated to specific canary versions by our automated dependency management. When users updated the SDK, this would cause `unmet peer` warnings if their project used an older, but still compatible, version of React. This effectively forced them to upgrade React to resolve the warnings, which is not ideal for a library update.

This happens because automated updates for `peerDependencies` in a library can inadvertently create breaking changes for its users by narrowing the compatibility range.

### Solution

This change introduces a more stable peer dependency management strategy for the SDK.

1.  **Widen React Peer Dependency Range**: The `peerDependencies` for `react`, `react-dom`, and `react-server-dom-webpack` in `sdk/package.json` have been changed to `>19.3.0-0 <20.0.0`. This broad range accepts any React 19 canary or minor release, preventing issues with `npm`'s handling of pre-release versions and giving users more flexibility.

2.  **Update Renovate Configuration**: The Renovate configuration (`renovate.json`) has been updated to disable automatic updates for *all* `peerDependencies` within `sdk/package.json`. This ensures that the compatibility range for tools like React, Vite, and Wrangler remains wide and is only changed manually and intentionally. Renovate will continue to update dependencies in the `starter` and `playground` projects for internal testing purposes.

This approach aligns with common library best practices, prioritizing user project stability and maximizing compatibility.