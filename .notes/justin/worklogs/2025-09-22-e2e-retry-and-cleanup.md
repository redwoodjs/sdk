# 2025-09-22: E2E Test Retries and Worker Cleanup

## Problem

E2E tests are failing due to two main reasons:
1.  Flaky network errors like `ECONNRESET` during dev server tests.
2.  Hitting the Cloudflare account limit of 500 workers during deployment tests.

## Plan

1.  **Implement Retry Logic**: Add a retry mechanism to the e2e test harness to automatically retry tests that fail with transient, code-based errors.
2.  **Verify Cleanup Script**: Systematically test the `scripts/cleanup-test-workers.sh` script to ensure it effectively removes test workers and prevents hitting the account limit, allowing tests to run reliably in CI.

## Context

The `ECONNRESET` error is a common transient issue in Node.js applications, and retrying is a standard way to handle it. The worker limit is a hard constraint from Cloudflare, so a robust cleanup process is essential for our e2e tests that perform deployments.

## Log

### Testing the Worker Cleanup Script

To verify that the cleanup script prevents us from hitting the Cloudflare worker limit, I'll follow a clear testing sequence:

1.  **Initial Cleanup**: Run `scripts/cleanup-test-workers.sh` to establish a clean baseline by deleting any lingering test workers from previous runs.
2.  **Run Tests**: Execute the `hello-world` e2e test suite. This will create new workers as part of its deployment tests.
3.  **Secondary Cleanup**: Run the cleanup script again to confirm that it correctly identifies and removes the workers created in the previous step.
4.  **Final Test Run**: Re-run the `hello-world` tests to ensure that the environment is clean and that tests can pass without being blocked by the worker limit.

This process will validate that our cleanup mechanism is working as expected and that we can reliably run our e2e tests in a CI environment without manual intervention.
