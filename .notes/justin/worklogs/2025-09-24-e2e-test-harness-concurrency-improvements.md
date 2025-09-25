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

## Addendum: Further Optimization with Shared Browser Instance

### Problem

While the initial concurrency refactor improves setup time, each individual test still incurs the overhead of launching and closing a new browser instance, which is slow.

### Plan

The test harness will be further optimized to use a single, shared browser instance per test suite.

1.  **Shared Browser Instance**: The `setupPlaygroundEnvironment` function's `beforeAll` hook will be updated to also create a single browser instance, which will be stored in a new global variable. The creation of the browser, dev server, and deployment will all happen concurrently.
2.  **Test Isolation via Pages**: The core test runners will be modified to use the shared browser instance. Instead of creating a new browser for each test, they will create a new, isolated `page`.
3.  **Updated Cleanup**: The per-test cleanup logic will now only be responsible for closing the `page`. The shared browser instance will be closed once in the `afterAll` hook, along with the other suite-level resources.

## Addendum: Final Harness Refinements

### Problem

The test harness implementation, while functionally correct, contained several issues that needed to be addressed:

- **Redundant Code**: The test runner functions (`testDev`, `testDeploy`, and their `.only` variants) had nearly identical implementations, violating the DRY principle.
- **Incorrect API Usage**: The refactoring initially broke the `.skip` and `.only` methods on the test runners.

### Plan

The harness was refactored to address these issues and improve its internal design.

1.  **Abstracted Test Runner**: A generic `createTestRunner` function was introduced to abstract away the common logic for setting up and executing a test against a given environment (`dev` or `deploy`).
2.  **Simplified Test Runners**: The `testDev`, `testDeploy`, and their `.only` variants were reimplemented as simple wrappers around the new `createTestRunner` function, eliminating code duplication.
3.  **Corrected API**: The test runners were converted back to standard functions to allow the `.skip` and `.only` properties to be correctly attached, restoring their full functionality.

## Addendum: Decoupled Test Execution

### Problem

Although the dev server and deployment setups are initiated concurrently in `beforeAll`, the tests for one environment (e.g., `dev`) cannot begin until the setup for *both* environments is complete. This creates an unnecessary bottleneck, where the faster setup process is forced to wait for the slower one.

### Plan

The test harness will be updated to allow tests for each environment to start as soon as their respective setup is finished, without waiting for the other.

1.  **Promise-Based State**: The global state will be modified to store promises for the `dev` and `deploy` instances, rather than the resolved instances themselves. The `setupPlaygroundEnvironment` function will populate these promises but will not `await` them.
2.  **Pre-Test Waiting**: The `createTestRunner` function will be refactored to use `describe.concurrent` and a `beforeEach` hook.
3.  **Lenient Timeout**: This hook will be responsible for `await`-ing the relevant setup promise (e.g., the dev server promise for a `testDev` run). It will have a separate, lenient timeout, ensuring that the wait time does not count against the individual test's execution timeout. This makes the system more robust, as the primary timeout logic remains within the setup functions themselves.

This change allows the `dev` and `deploy` test suites to run in a fully decoupled manner, improving overall test suite execution time.
