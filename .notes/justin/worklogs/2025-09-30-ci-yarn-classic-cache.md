# CI: Stabilize Yarn Classic E2E Tests

## Problem

End-to-end tests running with Yarn Classic (`yarn-classic`) on macOS runners were consistently failing during the dependency installation step with an `esbuild` error (exit code 88). This issue seemed specific to the combination of Yarn Classic and the macOS environment, suggesting a problem with how dependencies were being cached or built.

## Investigation and Solution

### Attempt 1: Explicit Cache Configuration

My initial hypothesis was that Yarn Classic's default caching behavior on macOS was leading to a corrupted or inaccessible cache state, causing `esbuild` to fail during its post-install build scripts. Unlike modern Yarn, which uses `.yarnrc.yml`, Yarn Classic (v1) uses a `.yarnrc` file.

The fix was to explicitly configure the cache location. By adding a step in the test setup process to create a `.yarnrc` file in the temporary project directory, I could direct Yarn Classic to use a predictable, clean cache folder:

```
cache-folder "/tmp/yarn-classic-cache"
```

This change immediately resolved the `esbuild` error, confirming that the issue was related to cache handling. For consistency, I also added explicit cache configurations for `npm` and modern `yarn`.

### Attempt 2: Increase Installation Retries

While the primary `esbuild` error was fixed, I observed that the `yarn-classic` jobs still failed intermittently due to general network flakiness during the installation step.

To improve reliability, I increased the number of retries for the `installDependencies` function in the test harness from 3 to 10. This provides a larger buffer for transient failures and has stabilized the remaining installation issues.

### GHA Workflow Fix

While debugging the CI failures, I also encountered an unrelated issue with the manual `workflow_dispatch` trigger for the E2E test workflow. The job that generates the test matrix was failing with a `jq` formatting error because the output was not on a single line.

The fix was to add the `-c` (compact output) flag to the `jq` command in `.github/workflows/playground-e2e-tests.yml`:

```diff
- JSON_ARRAY=$(echo "$JSON_ARRAY" | jq ". + [{\"os\":\"$o\",\"package-manager\":\"$p\"}]")
+ JSON_ARRAY=$(echo "$JSON_ARRAY" | jq -c ". + [{\"os\":\"$o\",\"package-manager\":\"$p\"}]")
```

## Outcome

1.  The `esbuild` error on macOS for `yarn-classic` is resolved.
2.  E2E tests for `yarn-classic` are now stable on all runners.
3.  The manual workflow dispatch for E2E tests now correctly generates the test matrix.

---

## PR Description

### fix(ci): Stabilize Yarn Classic E2E Tests

This change resolves a consistent `esbuild` failure (exit code 88) that occurred in end-to-end tests when using Yarn Classic on macOS CI runners.

The primary issue was traced back to Yarn Classic's default cache handling on macOS. This PR fixes the problem by explicitly configuring the cache location. During the test setup, a `.yarnrc` file is now created to direct Yarn Classic to use a specific cache folder, which prevents the `esbuild` error.

Additionally, this PR addresses two other points of instability:
-   **Installation Flakiness:** The number of retries for the dependency installation step has been increased from 3 to 10 to make the process more resilient to transient network issues in the CI environment.
-   **GitHub Actions Workflow:** A fix has been applied to the manual `workflow_dispatch` trigger. The `jq` command used to generate the test matrix now uses the `-c` (compact) flag to produce a single-line JSON output, as required by GitHub Actions.
