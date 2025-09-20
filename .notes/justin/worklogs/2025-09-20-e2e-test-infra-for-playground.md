
# Work Log: E2E Test Infrastructure for Playground

**Date:** 2025-09-20

## Problem

Our current smoke testing infrastructure is effective but tightly coupled to its specific workflow. We need a more flexible end-to-end testing solution to support a new `playground` directory, where we can add isolated test cases for various scenarios, including regressions and feature validation. The goal is to create a reusable, pragmatic testing framework by surgically refactoring our existing smoke test utilities, without introducing a heavy dependency like Playwright, which has limitations for our use case (e.g., testing HMR by modifying files).

## Plan

I will set up a new end-to-end testing system by building on the existing smoke test infrastructure. The approach is to refactor out the core functionalities (dev server management, deployment, environment setup) into reusable utilities and then use a lightweight test harness like `vitest` to orchestrate tests for projects within a new `playground` directory. All tests, for both starters and the playground, will run against a packed tarball of the SDK in an isolated temporary directory to accurately simulate a real-world installation.

### Brief

1.  **Create Work Log & Revise Docs:**
    *   Establish this work log to document the process.
    *   Merge `SMOKE-TESTING.md` into `docs/architecture/smokeTestingStrategy.md`.
    *   Rename the architecture doc to `docs/architecture/smokeTesting.md` and update it to reflect a unified testing strategy that includes both smoke tests and the new playground e2e tests.
    *   Delete the old `SMOKE-TESTING.md`.

2.  **Refactor Core Utilities:**
    *   **Surgically** extract reusable functions from the existing smoke test scripts (`runSmokeTests.mts`, `development.mts`, `release.mts`, `environment.mts`) to ensure we reuse as much battle-tested code as possible.
    *   Key utilities to create:
        *   `setupTestProject()`: To copy a project into an isolated temporary directory, install dependencies, and install the SDK from a packed tarball, reusing the exact same logic as the current smoke tests.
        *   `runDevServer()`: To start a development server and return its URL and a cleanup function.
        *   `deploy()`: To run the release process and return the deployment URL and cleanup metadata. This will reuse the existing `$expect` utility for CLI interactions to handle prompts programmatically.
        *   `getBrowser()`: To reuse the existing Puppeteer browser download and management logic.

3.  **Set Up Playground:**
    *   Create an `sdk/playground` directory.
    *   Add a `minimal` project inside it, based on `starters/minimal`.
    *   Update `pnpm-workspace.yaml` to include playground projects.
    *   Modify the playground project's `package.json` to use `workspace:*` for the SDK dependency. This is for development convenience; the tests themselves will override this by installing from a packed tarball.

4.  **Implement Test Harness:**
    *   Integrate `vitest` as the test runner.
    *   Develop a simple and programmatic test API that wraps `vitest`'s `test` function to provide automatic setup and teardown of resources.
    *   The API will expose `testDevServer` and `testDeployment` functions.
    *   **Example Usage:**
        ```typescript
        // Tests can be skipped via environment variables
        // RWSDK_PLAYGROUND_SKIP_DEV_SERVER_TESTS=1
        // RWSDK_PLAYGROUND_SKIP_DEPLOYMENT_TESTS=1

        testDevServer('it does something for dev', async ({ page, url, projectDir }) => {
          // do some expectation with url or puppeteer page
        });

        testDeployment('it does something for deploys', async ({ page, url }) => {
          // do some expectation with url or puppeteer page
        });

        // The API also supports vitest's standard .skip
        testDevServer.skip(...);
        ```
    *   For more complex scenarios requiring finer control, lower-level `createDevServer` and `createDeployment` functions will be available. These will still handle automatic resource cleanup after the test suite finishes.
    *   **Retry Logic:** To handle asynchronous UI updates, a lightweight `poll` utility function will be created to allow tests to wait for a condition to become true before making an assertion, emulating the retry-ability of heavier frameworks.
        ```typescript
        // Example polling utility
        async function poll(fn: () => Promise<boolean>, timeout: number = 5000) {
          // ... implementation ...
        }

        // Example usage
        await poll(async () => {
          const text = await page.textContent('body');
          return text.includes('Updated Content');
        });
        ```

5.  **Write Initial Test & Runner:**
    *   Create a simple e2e test for the `minimal` playground project that verifies the dev server and a deployment.
    *   Develop a master script to discover and execute all tests within the `playground` directory.

6.  **CI Integration:**
    *   Update the `.github/workflows/smoke-test-starters.yml` to execute the new playground test script as part of the existing test matrix (OS and package manager).

### Future Considerations

*   As discussed, I will add a note about creating e2e tests for past regressions. This new infrastructure will be the foundation for that effort.

---

## Progress So Far (Differential)

Before pausing to align on the plan, I completed the initial refactoring and setup tasks. Here is a summary of the work already done:

1.  **Documentation Revised:**
    *   The content from `SMOKE-TESTING.md` was merged into a new, unified architecture document at `docs/architecture/smokeTesting.md`.
    *   The old `SMOKE-TESTING.md` and `docs/architecture/smokeTestingStrategy.md` files have been deleted.

2.  **Core Utilities Refactored:**
    *   A new directory `sdk/src/lib/e2e` was created.
    *   Generic utilities for environment setup, dev server management, release/deployment, and browser handling were moved from `sdk/src/lib/smokeTests` into the new `sdk/src/lib/e2e` directory.
    *   The original smoke test scripts were updated to import and use these new shared utilities, ensuring no existing functionality was broken.

3.  **Playground Setup:**
    *   The `sdk/playground` directory was created.
    *   A `minimal` project was copied from the starters.
    *   `pnpm-workspace.yaml` was updated to include `sdk/playground/*`.
    *   The `package.json` for `sdk/playground/minimal` was modified to use a `workspace:*` dependency on `@redwoodjs/sdk`.

4.  **Test Harness Integration:**
    *   `vitest` was added as a workspace dependency.
    *   A `vitest.config.mts` was created in the `sdk` directory to run tests in the playground.
    *   A `test:e2e` script was added to the `sdk`'s `package.json`.

The next step is to implement the test harness API (`testDevServer`, `testDeployment`) we've just discussed and then use it in the placeholder test file that was created.
