# 2025-10-12: Fix npm Peer Dependency Resolution Failure

## Problem

After a recent dependency update, `npm install` fails in our test environments with an `ERESOLVE` error. The `react` version in the starter package is no longer compatible with the `peerDependency` range specified in the SDK.

**Error:**
```
npm error ERESOLVE unable to resolve dependency tree
...
npm error Could not resolve dependency:
npm error peer react@">=19.2.0-canary-3fb190f7-20250908 <20.0.0" from rwsdk@1.0.0-beta.9
...
npm error Found: react@19.3.0-canary-4fdf7cf2-20251003
```

## Investigation

The issue stems from our Renovate configuration. The rule that updates React canary versions (`starter-peer-deps`) targets `starter/package.json` and `playground/**/package.json`, but it does not include `sdk/package.json`.

As a result, when Renovate updates React in the starter project, it does not simultaneously update the `peerDependencies` range in the SDK. This causes a version mismatch and the observed dependency resolution failure.

The `renovate.json` rule in question:
```json
// renovate.json:60-77
{
  "description": "Update React peer dependencies in starter, playground, and addon projects, tracking the 'next' tag.",
  "matchFileNames": [
    "starter/package.json",
    "playground/**/package.json",
    "addons/**/package.json"
  ],
  "matchPackageNames": [
    "react",
    "react-dom",
    "react-server-dom-webpack",
    "@types/react",
    "@types/react-dom"
  ],
  "followTag": "next",
  "groupName": "starter-peer-deps",
  "schedule": ["every weekend"],
  "prPriority": 1
}
```

The `sdk/package.json` is managed by a different rule (`sdk-internal-deps`) which doesn't handle the special case of React canary releases.

## Solution

To resolve this, I'm making two changes:

1.  **Update `sdk/package.json`**: Align the `peerDependencies` for React packages with the version currently in the starter (`19.3.0-canary-4fdf7cf2-20251003`).
2.  **Update `renovate.json`**: Add `sdk/package.json` to the `matchFileNames` of the `starter-peer-deps` rule. This will ensure that Renovate updates the SDK's peer dependencies in the same PR as the starter and playground projects, keeping them in sync. This change is applied to both rule definitions that contribute to the `starter-peer-deps` group to cover React and non-React dependencies.

---

## PR Description

### chore(deps): sync react canary versions across projects

This change addresses a peer dependency resolution failure that occurs when `npm install` is run in test environments.

The `ERESOLVE` error was caused by a version mismatch between the React canary version used in the `starter` project and the allowed `peerDependency` range specified in the `sdk/package.json`. A similar issue would have also occurred for other peer dependencies like `wrangler` and `vite` during their next update.

This happened because the Renovate configuration rule responsible for updating React canary versions did not include the SDK's `package.json`. Consequently, when Renovate updated React in the starter and playground projects, the SDK's `peerDependencies` were not updated, leading to the incompatibility.

This commit introduces two changes to resolve the issue:

1.  **Updates SDK Peer Dependencies**: The `peerDependencies` for `react`, `react-dom`, and `react-server-dom-webpack` in `sdk/package.json` have been updated to a range that is compatible with the latest canary versions used in the starter project.

2.  **Updates Renovate Configuration**: The `renovate.json` file has been modified to include `sdk/package.json` in the `matchFileNames` for both `starter-peer-deps` rules (for React and non-React packages). This ensures that all of the SDK's `peerDependencies` will be updated in lockstep with the starter and playground projects in the future, preventing this issue from recurring.
