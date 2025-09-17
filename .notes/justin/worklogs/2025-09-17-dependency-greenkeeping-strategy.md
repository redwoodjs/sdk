# Work Log: Dependency Greenkeeping Strategy

Date: 2025-09-17

## Problem

The project currently lacks a formal strategy for managing dependencies, particularly the peer dependencies that are critical for user projects. Recent failures reported by users, linked to new versions of `@cloudflare/vite-plugin` and `wrangler`, highlight the need for a robust system to catch these issues proactively. Our goal is to establish a greenkeeping process that ensures stability for users while keeping our SDK's own dependencies up-to-date in a controlled manner.

## Plan

1.  **Define a Dependency Management Strategy**: Establish clear rules for different categories of dependencies (peer dependencies, SDK internal dependencies, starter project dependencies).
2.  **Automate with CI**: Implement a CI workflow, likely using Renovate or Dependabot, to automate dependency updates according to the defined strategy.
3.  **Implement a Failure Protocol**: Create a process to handle failures caused by dependency updates. When an update to a peer dependency in a starter app breaks the build or tests, the system should:
    a.  Alert maintainers.
    b.  Allow for a quick, maintainer-triggered action to pin the dependency in the starter to the last known good version.
    c.  Constrain the peer dependency version range in the `sdk/package.json` to exclude the faulty version.
    d.  This will allow for a patch release of the SDK that protects users from the broken dependency version while the root cause is investigated.
4.  **Document the Strategy**: The new process will be documented in a new file, `docs/CONTRIBUTING-dependency-management.md`, to provide context for contributors and maintainers.
5.  **Initial Implementation & Test**: We will start by attempting to update the peer dependencies in the starter projects to the versions that are reportedly causing issues. This will serve as the first test of our failure-handling protocol.

## Execution

### Step 1: Analyze Current Dependencies and Reported Failures

Users have reported that `wrangler > 4.35.0` and `@cloudflare/vite-plugin > 1.12.4` cause the build to fail with the error: `Must use "outdir" when there are multiple input files`.

-   **`sdk/package.json` `peerDependencies`:**
    -   `wrangler`: `^4.35.0`
    -   `@cloudflare/vite-plugin`: `^1.12.4`
-   **`starters/minimal/package.json`:**
    -   `wrangler`: (not specified, will be installed by user)
    -   `@cloudflare/vite-plugin`: `1.12.4` (pinned)
-   **`starters/standard/package.json`:**
    -   (To be inspected)

The current `peerDependencies` ranges in the SDK are permissive and allow these newer, broken versions. The starter packages need to be updated to test this failure condition within our own CI.

### Step 2: Reproduce the Failure

I updated the `devDependencies` in both `starters/minimal/package.json` and `starters/standard/package.json` to the following versions, which were reported to cause failures:

-   `@cloudflare/vite-plugin`: `1.13.2`
-   `wrangler`: `4.37.1`

I then ran the smoke tests for both starter projects.

**Findings:**

The smoke tests for both starters failed with the exact error reported by users: `Error: Build failed with 1 error: error: Must use "outdir" when there are multiple input files`. This confirms that our smoke test suite is effective at catching this type of regression.

With the failure successfully reproduced, we can now proceed with testing our failure protocol.

### Step 3: Apply Corrective Action

Following our defined failure protocol, I am now taking corrective action to protect users from this regression.

1.  **Reverted Starters**: The `package.json` files for `starters/minimal` and `starters/standard` have been reverted to the last known good versions:
    -   `@cloudflare/vite-plugin`: `1.12.4`
    -   `wrangler`: `4.35.0`

2.  **Constrained SDK Peer Dependencies**: The `peerDependencies` in `sdk/package.json` have been updated to prevent installations of the problematic versions:
    -   `@cloudflare/vite-plugin`: `^1.12.4` -> `>=1.12.4 <1.13.0`
    -   `wrangler`: `^4.35.0` -> `>=4.35.0 <4.36.0`

These changes complete the test of our greenkeeping protocol. We have successfully:
1.  Identified a regression via automated testing in our starter projects.
2.  Taken corrective action to shield users from the issue.

This ensures the stability of the SDK for our users while we investigate the root cause of the failure in the upstream dependencies.
