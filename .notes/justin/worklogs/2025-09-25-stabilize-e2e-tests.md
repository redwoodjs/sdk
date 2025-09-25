# Work Log: Stabilizing End-to-End Tests

**Date:** 2025-09-25

## Problem

The end-to-end test suite is exhibiting instability, particularly in CI environments across different package managers (`npm`, `yarn`). The primary symptoms are:

1.  **`hookTimeout` failures**: The `setupPlaygroundEnvironment` hook frequently times out after 5 minutes. This is most likely due to slow dependency installations, as each test suite creates an isolated environment and installs dependencies from scratch without a shared cache for `npm` and `yarn`.
2.  **Flaky assertions**: Tests that check for the absence of console errors or network failures are proving to be unreliable. An example from the `shadcn` playground shows an assertion failing due to a `net::ERR_ABORTED` error, which may not represent a true failure of the application logic.

The goal is to improve the reliability and performance of the E2E test suite to ensure a stable CI process.

## Plan

To address these issues, I will implement a multi-faceted approach focusing on increasing timeouts, introducing caching, adding targeted retries, and removing brittle assertions.

### 1. Increase Test Timeouts

As an immediate mitigation, I'll increase the global timeouts for test hooks to provide more headroom for long-running operations like dependency installation.

-   **Action**: Modify `playground/vitest.config.mts` to increase `hookTimeout` and `testTimeout` from 5 minutes to 15 minutes.
-   **Action**: Increase related timeout constants in `sdk/src/lib/e2e/testHarness.mts`, such as `SETUP_PLAYGROUND_ENV_TIMEOUT`, to align with the new hook timeout.

### 2. Implement Package Manager Caching

To address the root cause of the slow setup, I'll introduce a shared cache for `npm` and `yarn` within the test environment.

-   **Action**: Update the `installDependencies` function in `sdk/src/lib/e2e/environment.mts`.
    -   For `npm`, add the `--cache` flag, pointing to a temporary directory.
    -   For `yarn`, add the `--cache-folder` flag, also pointing to a temporary directory.
-   `pnpm` already uses a global cache, so no changes are needed for it.

### 3. Add Fine-Grained Retries

To handle transient network or process-related errors, I'll introduce a generic retry utility and apply it to the dependency installation step, which is a common point of failure.

-   **Action**: Create a new `retry` utility function in `sdk/src/lib/e2e/retry.mts`.
-   **Action**: Wrap the call to `installDependencies` within `copyProjectToTempDir` in `sdk/src/lib/e2e/environment.mts` with the new `retry` utility.

### 4. Remove Flaky Console Error Tracking

Based on the previous analysis and your feedback, the console and network error tracking is too brittle. I will remove it entirely to prevent false negatives.

-   **Action**: Delete the `trackPageErrors` function and all its usages from `sdk/src/lib/e2e/testHarness.mts`.
