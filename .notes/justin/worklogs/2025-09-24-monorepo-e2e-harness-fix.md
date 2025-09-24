## Problem

The end-to-end test for the `monorepo-top-level-deps` playground fails when run via the automated test harness, but it succeeds when run manually within the project directory.

The root cause is that the test harness is not monorepo-aware. It is designed to test single-package projects. When it prepares the test environment, it copies only the project's subdirectory (e.g., `packages/project`) into a temporary location. This isolates the project from its monorepo context, breaking `workspace:*` protocol resolution and access to hoisted dependencies that would normally be present in a parent `node_modules` directory. The manual test run works because it operates within the fully intact monorepo structure.

## Plan

The test harness will be updated to correctly handle monorepo projects. This involves making it aware of the monorepo root and adjusting how it sets up the test environment.

1.  **Add `monorepoRoot` Parameter:** The core `setupPlaygroundEnvironment` function in `testHarness.mts` will be modified to accept an optional `monorepoRoot` path. This will be the signal that a monorepo environment is needed.

2.  **Update Environment Setup Logic:**
    -   **Copy Operation:** The `copyProjectToTempDir` function will be updated. If `monorepoRoot` is provided, it will copy the entire monorepo directory to the temporary location, preserving the full project structure. Otherwise, it will copy the `projectDir` as it does currently.
    -   **Working Directory:** The functions for installing dependencies and running the dev server will be adjusted. While the entire monorepo is copied, these operations must still be executed from the perspective of the specific project being tested (i.e., inside `.../temp-monorepo/packages/project/`).

This change will ensure that the automated test environment is a faithful replica of the manual development environment, allowing tests for monorepo projects to run correctly.
