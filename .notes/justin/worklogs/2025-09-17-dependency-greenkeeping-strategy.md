# Work Log: Dependency Greenkeeping Strategy

Date: 2025-09-17

## 1. Problem Definition & Goal

The project lacked a formal strategy for managing dependencies, leading to user-reported failures when new versions of critical peer dependencies like `@cloudflare/vite-plugin` and `wrangler` were released. The SDK's permissive `peerDependencies` ranges allowed these broken versions, but our CI had no mechanism to proactively detect the resulting build failures.

The goal was to establish a robust, automated greenkeeping process using Renovate that would:
1.  Provide an early-warning signal for regressions in critical peer dependencies.
2.  Keep the SDK's own dependencies up-to-date in a controlled, low-noise manner.
3.  Establish and document a clear protocol for handling failures.

## 2. Attempt #1: Initial Setup with a GitHub Actions Workflow

The initial plan was to use the `renovatebot/github-action` to run Renovate on a schedule. A `renovate.json` configuration was created with initial grouping rules, and a temporary `test-renovate-flow.yml` workflow was added to validate the setup on a feature branch without affecting `main`.

**Findings & Iterations:**
This approach was plagued by a series of configuration and permission issues that were solved iteratively by inspecting the GitHub Actions logs:
-   **Invalid Inputs**: The workflow initially used `renovate-args`, which is not a valid input. This was corrected by passing arguments as environment variables (e.g., `RENOVATE_AUTODISCOVER_FILTER`).
-   **Invalid `renovate.json` Syntax**: The logs revealed multiple validation errors. `matchFilePaths` was corrected to `matchFileNames`, and `schedule` syntaxes were fixed.
-   **Incorrect Branch Context**: Renovate was running against the `main` branch by default. This was fixed by setting the `RENOVATE_BASE_BRANCHES` environment variable to point to our feature branch.
-   **Permission Errors**: A persistent `WARN: Cannot access vulnerability alerts` message was resolved by adding a top-level `permissions` block to the workflow to grant `security-events: read` access, overriding potentially restrictive repository defaults.

While the workflow was eventually made to run, this process proved to be brittle and required deep knowledge of the GitHub Actions environment.

## 3. Attempt #2: Pivoting to the Renovate GitHub App

A review of best practices in other major open-source projects revealed that the Renovate GitHub App is the overwhelmingly preferred method over a self-hosted action. The app is free for open-source and handles all infrastructure, authentication, and permission concerns automatically.

**Decision & Action:**
The strategy was pivoted to use the GitHub App. To test this safely, a "pointer" configuration was temporarily added to the `main` branch, instructing the app to load its full configuration from our feature branch. This provided a robust, zero-maintenance solution and eliminated all the issues from the previous attempt. The temporary GitHub Actions workflows were deleted.

## 4. Attempt #3: Solving the React Canary Downgrade Stalemate

With the Renovate App running correctly, it successfully identified and created PRs for most dependency groups. However, it consistently proposed to *downgrade* the React canary versions in the starter projects. This was incorrect, as the starters were already on a newer version. This downgrade caused an `ERESOLVE` failure in CI because the older version did not satisfy the SDK's `peerDependencies` range.

This began a series of investigations to diagnose why Renovate was selecting an old version:

-   **Hypothesis 1: Stale `peerDependencies` range.** The initial thought was that the complex, hash-based version string in the SDK's `peerDependencies` was confusing Renovate. The range was simplified (e.g., to `>=19.2.0-0`), but this had no effect, correctly proving that Renovate uses `npm` for version discovery, not our `peerDependencies`.

-   **Hypothesis 2: Using a more stable tag in `package.json`.** The next attempt involved changing the React versions in the starters' `package.json` files from a pinned canary version to the `next` dist-tag. This was also incorrect, as the goal is to have Renovate manage the updates, not `npm`.

-   **Hypothesis 3: Using `allowedVersions` and `versioning`.** A more advanced Renovate configuration was attempted, using `allowedVersions` with a semver range and setting `"versioning": "loose"` to better handle the non-standard canary versions. This also failed to resolve the issue.

**Final Finding and Solution:**
The root cause was that Renovate's default behavior struggles to determine the "latest" version when dealing with unstable channels that use complex pre-release identifiers (e.g., `19.2.0-canary-....`).

The correct and final solution was to give Renovate an explicit instruction. A specific rule was created for the React packages, and the `"followTag": "next"` option was added. This tells Renovate to completely ignore the `latest` tag and all other versions, and instead only track the version of React that is currently published to the `next` distribution tag on `npm`.

This was successful. We configured the `followTag: 'next'` rule, and the Renovate App was successful in achieving our goal: it now correctly identifies and proposes updates to the latest canary versions for all React dependencies.

## 5. Final Actions: Documentation and Simplification

With the technical implementation now stable and correct, the final steps involved cleaning up the process and documentation:

-   **Simplified Failure Protocol**: The initial plan included an automated workflow to pin dependencies on failure. This was identified as a premature optimization and was removed in favor of a simpler, manual protocol documented in `CONTRIBUTING.md`.
-   **Consolidated Configuration**: The `renovate.json` file (renamed to `default.json` per Renovate preset conventions) was refined with clearer grouping rules for all categories of dependencies.
-   **Updated Documentation**: The `CONTRIBUTING.md` file was updated to reflect the complete, final greenkeeping strategy, including the dependency categories and the manual failure protocol.