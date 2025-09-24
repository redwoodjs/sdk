# 2025-09-24 - E2E Test Suite Refactoring

## Summary of Initial Refactors

Before tackling the larger concurrency improvements, a series of refactors were applied to the existing E2E tests to improve reliability and align with better testing practices.

- **Standardized Test Conventions**: All E2E tests in the `playground/` directory were updated to use a consistent set of conventions. This included:
  - Adding `waitForHydration` before any user interaction to ensure the client-side application was fully interactive.
  - Consolidating assertions within `poll` blocks to create more resilient tests that wait for conditions to be met.
  - Introducing helper functions (e.g., `getPageContent`, `getButton`) within tests to improve readability and reduce code duplication.
- **Bug Fixes and Minor Improvements**:
  - Corrected a faulty regular expression in the `useid-test` that was causing test failures due to an improperly escaped backslash (`\\w` instead of `\w`).
  - Fixed an incorrect Puppeteer API call, replacing the non-existent `page.waitForXPath` with the correct `page.waitForSelector('xpath/...')`.
  - Replaced local favicon asset links in the `chakra-ui` and `shadcn` playgrounds with inline data URIs to prevent 404 errors during test runs.
  - Updated the Content Security Policy (CSP) in the `chakra-ui` playground to allow `data:` URIs for images, resolving issues caused by the new favicon data URIs.

## Plan: E2E Test Harness Concurrency Refactor

### Problem

The E2E test suite's performance is slow because each `testDevAndDeploy` call serially sets up and tears down a dev server and a Cloudflare deployment. This sequential, per-test setup is a significant bottleneck.

### Plan

The test harness will be refactored to perform the expensive setup operations (dev server startup and deployment) once per test suite, concurrently.

1.  **Concurrent Suite-Level Setup**:
    - The `setupPlaygroundEnvironment` function will be modified to accept `dev?: boolean` and `deploy?: boolean` options (defaulting to `true`).
    - Within the `beforeAll` hook, it will create **two separate, isolated project directories**—one for the dev server and one for the deployment—to prevent conflicts.
    - It will then start the dev server and run the deployment **concurrently** using `Promise.all`.
    - The resulting server and deployment instances will be stored in a global, suite-level state, making them available to all subsequent tests in the file.

2.  **Refactor Test Helpers**:
    - The `testDev`, `testDeploy`, and `testDevAndDeploy` functions will be updated to consume the pre-booted instances from the global state instead of creating their own. They will continue to manage their own browser instances for test isolation.

3.  **Concurrent Test Execution**:
    - To further improve performance, `testDev` and `testDeploy` will be modified to use Vitest's `test.concurrent`. This will allow the dev and deployment variations of a test defined with `testDevAndDeploy` to run in parallel.

4.  **Centralized Cleanup**:
    - The global `afterAll` hook, which already handles environment cleanup, will be updated to also tear down the suite-level dev server and deployment resources.
