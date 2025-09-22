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

To verify that the in-test cleanup is working correctly and not leaking workers, I'll run the `hello-world` test and then use the Cloudflare API to confirm that the worker created during the test run has been deleted.

### Optimizing D1 Cleanup

The tests spend time attempting to clean up D1 databases for projects that do not have one configured. This is inefficient and can introduce noise into the test logs. To fix this, the cleanup logic will be updated to first inspect the project's `wrangler.jsonc`. It will only attempt to delete a D1 database if the `d1_databases` key is present and contains at least one database configuration.

## Solution

The e2e test harness was successfully updated to be more resilient and efficient. Key changes include:
- A retry mechanism was added to automatically handle transient, code-based network errors during test runs.
- The worker cleanup process was made more robust by replacing the `wrangler` CLI command with a direct Cloudflare API call, resolving persistent credential and command-parsing issues.
- The cleanup logic for D1 databases was optimized to first check the project's `wrangler.jsonc` and only attempt deletion if a database is configured.
- A polling mechanism was added to the deployment function to wait for the worker to become routable before proceeding with tests, preventing timeout errors.
- The default polling timeout was increased to provide a larger buffer for deployment warmup.

## PR Description

- **Automatic Retries**: Added a retry mechanism to handle transient network errors.
- **Reliable Worker Cleanup**: Replaced `wrangler delete` with a direct Cloudflare API call for worker cleanup.
- **Smarter Database Cleanup**: The D1 cleanup now checks `wrangler.jsonc` before attempting deletion.
- **Deployment Polling**: Added polling to wait for deployments to be live before running tests.
- **Increased Test Timeout**: Increased the polling timeout to 2 minutes.
