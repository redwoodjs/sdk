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

## Update: Workspace Resolution Failure in Temp Dir

The previous fix of copying the entire monorepo into the temporary directory was a necessary step, but it did not solve the problem on its own. The test still fails because the `ui-lib` dependency cannot be resolved.

The root cause has been traced to the dependency installation step. The test harness was executing the install command (e.g., `pnpm install`) from within the project's sub-directory (`.../packages/project`) instead of from the monorepo's root.

When run from a sub-directory, the package manager is unaware of the monorepo's workspace configuration (e.g., `pnpm-workspace.yaml` or a `workspaces` field in `package.json`). As a result, it cannot resolve `workspace:*` dependencies, causing the build to fail. The manual test runs work because the user is implicitly running `pnpm install` from the monorepo root.

The solution is to make the test harness's installation step behave like a user in a real monorepo. This requires a package-manager-agnostic way for a playground to define its workspace structure.

### Revised Plan

1.  **Introduce `rwsdk-workspace.json`:** A new convention will be established. A playground that is a monorepo can include a `rwsdk-workspace.json` file at its root. This file will contain a `workspaces` array (e.g., `["packages/*", "vendor/*"]`) to define its structure agnostically.

2.  **Generate Native Workspace Config:** In the `copyProjectToTempDir` function, after copying the monorepo, the harness will look for `rwsdk-workspace.json`. If found, it will read the `workspaces` array and generate the appropriate native configuration file (`pnpm-workspace.yaml` or a `package.json` with a `workspaces` field) based on the `packageManager` being used for the test run.

3.  **Install from Monorepo Root:** The `installDependencies` function will be called with the temporary monorepo's root as the working directory. This allows the package manager to detect the workspace config file and correctly link all local packages.
