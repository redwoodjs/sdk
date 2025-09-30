# Per-Test E2E Retries

## Problem

The E2E test suite uses a script to retry the entire test run on failure. This is inefficient and can hide the scope of test flakiness. A more granular, per-test retry mechanism is needed to improve reliability and debugging, especially for intermittent failures that occur in CI.

## Plan

1.  **Implement Per-Test Retry Logic**: Modify the existing `runTestWithRetries` helper in the E2E test harness to include a general fallback retry mechanism in addition to its current error-code-specific retries.
2.  **Externalize Configuration**: Make the retry counts configurable via environment variables (`RWSDK_TEST_MAX_RETRIES` and `RWSDK_TEST_MAX_RETRIES_PER_CODE`), with sensible defaults.
3.  **Update CI Configuration**: Adjust the GitHub Actions workflow to use a higher number of retries for nightly builds to better catch flaky tests over time. Remove the whole-suite retry script.
4.  **Update Documentation**: Document the new retry strategy in the `endToEndTesting.md` architecture document and `CONTRIBUTING.md`.
