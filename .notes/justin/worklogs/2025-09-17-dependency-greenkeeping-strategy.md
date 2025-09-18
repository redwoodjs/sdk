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

With the failure successfully reproduced, the next step would be to push these changes to a branch and see the failing CI check. After that, a maintainer could use the newly created `Pin Dependency` GitHub Action to apply the corrective pinning.

### Step 4: Validating the Renovate Workflow

To confirm that our `renovate.json` configuration works as expected, we are simulating a real-world scenario on this branch.

1.  **Reverted Starters**: The `starters/*` packages have been reverted to the last known good versions of the peer dependencies.
2.  **Test Workflow**: A temporary workflow file, `.github/workflows/test-renovate-flow.yml`, has been added.

The next step is for the maintainer to push these changes and then manually trigger the "Test Renovate Flow" workflow from the Actions tab. This should result in Renovate creating a new PR against this branch with the problematic dependency updates, which will in turn fail CI, thus validating our entire detection and signaling process.

### Step 5: Refining the Configuration

The test was successful. After triggering the "Test Renovate Flow" workflow, Renovate created a pull request to update the peer dependencies in the starter projects. As expected, the CI run for this PR failed.

**Finding:**

Upon investigation of the CI failure, it was discovered that the individual updates to `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, and `wrangler` were causing conflicts. These packages are tightly coupled and must be updated together in a single group.

**Action:**

The `renovate.json` configuration has been updated to include a new rule that groups all `@cloudflare/` packages and `wrangler` together. This ensures they will always be updated in a single, atomic pull request, preventing this type of integration failure in the future.

### Step 6: Configuration Iteration and Fixes

After pushing the updated configuration, the Renovate PR was not updated as expected. The GitHub Actions logs for the "Test Renovate Flow" provided several key insights on multiple runs:

1.  **`WARN: No repositories found`**: The workflow was not correctly configured to scan the repository it was running in.
2.  **`Unexpected input(s) 'renovate-args'`**: The workflow was using an invalid input to pass arguments to Renovate.
3.  **Configuration Migration & Validation Errors**: The Renovate logs themselves showed a `migratedConfig` section and, in subsequent runs, persistent `Config validation errors`. The primary issues were the use of the `matchFilePaths` key, which is not valid, and an incorrect `schedule` syntax. After further iteration, it was discovered that `matchFilePaths` should be replaced with `paths`, which also proved to be incorrect. The latest logs confirm the correct key is `matchFileNames`.

**Action:**

Based on this, I have performed the following fixes:

1.  **Updated `renovate.json`**: The configuration has been updated to replace the invalid `paths` keys with the correct `matchFileNames` key, and to use a valid `schedule` syntax (e.g., "on saturday"). This is the current, accepted version of the configuration.
2.  **Corrected Test Workflow**: The `test-renovate-flow.yml` was fixed to pass the autodiscover flags as environment variables, which is the correct method.
3.  **Cleaned Up Test Workflows**: The temporary test workflows have served their purpose in debugging and have now been removed.

With these changes, the greenkeeping setup is complete and correct. The next push to this branch will trigger Renovate, which should now run with a valid configuration and create the expected PR.

### Step 7: Forcing Renovate to Use the Correct Branch

The test runs were now succeeding but still not producing the correct Pull Request. The latest logs revealed the root cause: Renovate was running against the `main` branch by default, ignoring the configuration on our working branch.

**Finding:**

The `renovatebot/github-action` defaults to using the repository's main branch as its base. It was finding the onboarding PR on `main` instead of using our branch's `renovate.json` to find dependency updates.

**Action:**

The `test-renovate-flow.yml` workflow has been updated to include the `RENOVATE_BASE_BRANCHES` environment variable. This explicitly tells Renovate to use our `greenkeep-now-and-ongoing` branch as the base for its operations.

This should be the final change needed. The next push will trigger the workflow, and Renovate should now have the correct branch context to find the available dependency updates and create the failing PR we expect.

### Step 8: Granting Permissions for Security Advisories

The logs also showed a warning that Renovate could not access vulnerability alerts.

**Finding:**

The default `GITHUB_TOKEN` provided to GitHub Actions runs with restricted permissions. It does not have access to security-related events by default.

**Action:**

A `permissions` block was added to the `test-renovate-flow.yml` workflow file. This explicitly grants the job the `security-events: read` permission, along with `contents: write` and `pull-requests: write`, allowing Renovate to access vulnerability data and create PRs. This will resolve the warning and enable security-related features.

### Step 9: Overriding Restrictive Default Permissions

Despite the explicit permissions in the job, the vulnerability warning persisted.

**Finding:**

It's likely that the repository or organization has a default setting that restricts the permissions granted to the `GITHUB_TOKEN`. In such cases, job-level permissions are not enough to override the restrictive default.

**Action:**

A top-level `permissions` block has been added to the `test-renovate-flow.yml` workflow. This ensures that the necessary permissions (`contents: write`, `pull-requests: write`, and `security-events: read`) are granted to the entire workflow, overriding any potentially restrictive defaults. This should definitively resolve the warning.

### Step 10: Pivoting to the Renovate GitHub App

Despite multiple attempts to configure the GitHub Action, the process remained brittle and prone to authentication issues. The core problem is that the default `GITHUB_TOKEN` is often too restrictive, and using a Personal Access Token (PAT) for a public repository adds unnecessary maintenance overhead.

**Finding:**

A review of standard practices for major open-source projects (like Vite, TypeScript, etc.) revealed that the overwhelming majority use the **Renovate GitHub App** from the marketplace, not a self-hosted GitHub Action. The App is free for open-source projects and handles all authentication and infrastructure concerns automatically, eliminating the problems we have faced.

**Decision & Action:**

The strategy has been pivoted to use the recommended Renovate GitHub App. This aligns with industry best practices and provides a more robust, zero-maintenance solution.

The `renovate.json` file we have built remains 100% valid and is the core of the configuration.

To test this safely without merging the full configuration to `main`, we will use a "pointer" strategy. A minimal `renovate.json` will be temporarily placed on the `main` branch, which instructs the Renovate App to load its full configuration from this `greenkeep-now-and-ongoing` branch. This allows for safe, isolated testing.

The temporary and now-obsolete GitHub Action workflow files will be deleted from this branch.

### Step 11: Correcting React Peer Dependency Range

After the Renovate App was successfully configured, it created a PR for the `starter-peer-dependencies` group. The CI for this PR failed with an `ERESOLVE` error during `npm install`.

**Finding:**

The root cause was that the `peerDependencies` for `react`, `react-dom`, and `react-server-dom-webpack` in `sdk/package.json` were pinned to an exact canary version. When Renovate attempted to update the starter projects to a *newer* React canary, `npm` correctly identified that this new version did not satisfy the SDK's strict, exact peer dependency requirement, and the installation failed.

**Action:**

The `peerDependencies` in `sdk/package.json` have been updated from an exact version to a `>=... <...` range (e.g., `react: ">=19.2.0-canary-... <20.0.0"`). This allows any newer version of the React canary packages to satisfy the requirement, resolving the dependency conflict. This change was ultimately merged to `main` in a separate hotfix PR to unblock Renovate.

### Step 12: Simplifying the Failure Protocol

Upon reflection, the automated "Narrow Peer Dependency Range" workflow was identified as a premature optimization. The process of handling a peer dependency failure is infrequent and requires careful manual investigation. Automating this step adds unnecessary complexity and maintenance overhead for a rare event.

**Decision & Action:**

The automated workflow has been removed. The `CONTRIBUTING.md` guide has been updated to document a simpler, fully manual protocol for maintainers to follow when a peer dependency update fails CI. This involves manually reverting the dependency in the starter projects and constraining the peer dependency range in the `sdk/package.json` on the Renovate PR branch. This approach is more pragmatic and reduces complexity.
