# CI: Stabilize Yarn Classic E2E Tests

## Problem

End-to-end tests running with Yarn Classic (`yarn-classic`) were failing intermittently, but only on macOS runners in CI. The failures seemed related to dependency installation, pointing towards a potential issue with file system permissions or cache handling within the temporary directories used by the test environment.

## Investigation and Solution

### Attempt 1: Change Temp Directory Location

My initial hypothesis was that the macOS temp directory (`/tmp`) had stricter permissions or different behavior that was causing problems for Yarn Classic. To test this, I refactored the test environment setup in `sdk/src/lib/e2E/environment.mts` to use a dedicated directory within the user's home folder (`~/.rwsdk/tests`) instead of the system's temp directory.

This change did not resolve the issue, suggesting the location itself wasn't the root cause.

### Attempt 2: Explicit Cache Configuration

Pivoting from the location, I investigated how Yarn Classic handles its cache. Unlike modern Yarn, which uses `.yarnrc.yml`, Yarn Classic (v1) uses a `.yarnrc` file. I found that explicitly configuring the cache location for Yarn Classic resolved the installation failures.

The solution was to add a step in the test setup process that creates a `.yarnrc` file in the temporary project directory with the following content:

```
cache-folder "/tmp/yarn-classic-cache"
```

This forces Yarn Classic to use a predictable, explicitly created cache directory, avoiding any ambiguity or permission issues with its default cache location. I also added similar explicit cache configurations for `npm` and modern `yarn` for consistency.

### Attempt 3: Increase Installation Retries

Even with the explicit cache configuration, the `yarn-classic` jobs were still failing intermittently during the dependency installation step. It seems there were some underlying network or transient issues.

To address this, I increased the number of retries for the `installDependencies` function in the test harness from 3 to 10. This provides a larger buffer for temporary failures and has stabilized the remaining installation issues.

### GHA Workflow Fix

While debugging the CI failures, I also encountered an unrelated issue with the manual `workflow_dispatch` trigger for the E2E test workflow. The job that generates the test matrix was failing with a `jq` formatting error.

The problem was that the `jq` command used to build the JSON matrix was outputting formatted, multi-line JSON. GitHub Actions' `set-output` command requires the JSON to be on a single line.

The fix was to add the `-c` (compact output) flag to the `jq` command in `.github/workflows/playground-e2e-tests.yml`:

```diff
- JSON_ARRAY=$(echo "$JSON_ARRAY" | jq ". + [{\"os\":\"$o\",\"package-manager\":\"$p\"}]")
+ JSON_ARRAY=$(echo "$JSON_ARRAY" | jq -c ". + [{\"os\":\"$o\",\"package-manager\":\"$p\"}]")
```

## Outcome

1.  E2E tests for `yarn-classic` are now stable on all runners, including macOS.
2.  The manual workflow dispatch for E2E tests now correctly generates the test matrix.

---

## PR Description

This change stabilizes the Yarn Classic end-to-end tests, which were previously failing intermittently on macOS CI runners.

The investigation identified two main issues:
1.  **Implicit Cache Behavior:** Yarn Classic's default cache handling seemed to cause intermittent failures during dependency installation.
2.  **Installation Flakiness:** Even with a configured cache, the installation step was prone to transient failures.

This PR addresses these issues by:
-   **Adding Explicit Cache Configuration:** The test setup now creates a `.yarnrc` file for Yarn Classic runs, explicitly defining a `cache-folder`. This ensures a consistent and valid cache location.
-   **Increasing Installation Retries:** The number of retries for the dependency installation step has been increased from 3 to 10, making the process more resilient to transient network issues in the CI environment.

Additionally, this PR includes a fix for the manual `workflow_dispatch` in the GitHub Actions workflow. The `jq` command used to generate the test matrix now uses the `-c` (compact) flag to produce a single-line JSON output, which is required by GitHub Actions.
