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
