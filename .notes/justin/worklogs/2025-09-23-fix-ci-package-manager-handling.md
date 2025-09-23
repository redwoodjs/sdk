
# 2025-09-23: Standardize Package Manager Handling in E2E Tests

## Problem

The end-to-end and smoke tests were failing when run with modern Yarn (`yarn@berry`). The CI logs showed a `YN0028` error, which indicates that the installation process tried to modify the `yarn.lock` file, a behavior that is disallowed by default in CI environments to ensure reproducible builds.

Additionally, the local testing setup was inconsistent with the CI environment. The GitHub Actions workflows contained logic to switch between different package managers (`pnpm`, `npm`, `yarn`, `yarn-classic`), but this logic was absent from the local test scripts. This meant that running tests locally did not accurately replicate the CI environment, particularly for different versions of Yarn.

Finally, our Yarn Berry test configuration was forcing the use of `node_modules` via the `nodeLinker` setting, which prevented us from testing our framework's compatibility with Yarn's native Plug'n'Play (PnP) feature.

## Attempt

The goal was to resolve the Yarn lockfile error and unify the local and CI test environments so that they behave identically.

1.  **Allow Lockfile Changes for Yarn Berry**: To fix the `YN0028` error, I updated the test environment setup script (`sdk/src/lib/e2e/environment.mts`) to create a `.yarnrc.yml` file in the temporary test project directory. This file now includes `enableImmutableInstalls: false`, which instructs modern Yarn to permit changes to the lockfile during dependency installation.

2.  **Enable Yarn PnP Testing**: I removed the `nodeLinker: node-modules` line from the generated `.yarnrc.yml` file. This change ensures that when tests run with Yarn Berry, they use the default Plug'n'Play linker, allowing us to validate our framework's compatibility with this feature.

3.  **Centralize Package Manager Setup**: To align the local and CI environments, I moved the package manager setup logic from the GitHub Actions workflows directly into the `installDependencies` function within `sdk/src/lib/e2e/environment.mts`. The script now uses `corepack` to prepare and activate the correct Yarn version (`yarn@stable` or `yarn@1.22.19`) within the temporary test directory before running the install command.

4.  **Simplify CI Workflows**: With the package manager logic centralized in the test script, I removed the redundant setup steps from the CI configuration files (`.github/workflows/playground-e2e-tests.yml` and `.github/workflows/smoke-test-starters.yml`). The workflows are now simpler, only responsible for enabling `corepack` and installing the monorepo's dependencies.

This set of changes ensures that the test environment is configured consistently, whether running locally or in CI, and that our tests accurately reflect real-world usage of different package managers, including Yarn's PnP mode.

## Addendum: Local Testing Improvements

While testing the package manager fixes, a couple of additional improvements were made:

1.  **Test Timeout Adjustment**: The `setupPlaygroundEnvironment` function in the E2E test harness (`sdk/src/lib/e2e/testHarness.mts`) occasionally timed out, especially when using Yarn, which can be slow to install dependencies. The timeout was increased to 10 minutes to provide a larger buffer and prevent premature test failures.
2.  **Documentation for Running Specific Tests**: It was discovered that the correct way to run a single playground E2E test is by passing a path relative to the `playground/` directory. The `CONTRIBUTING.md` file has been updated to document the correct command (`pnpm test:e2e -- <path_to_test>`) and how to use environment variables like `PACKAGE_MANAGER` and `DEBUG` for more targeted testing.
3.  **Yarn PnP Compatibility**: The `setupTarballEnvironment` function in `sdk/src/lib/e2e/tarball.mts` included a check to verify the installed `rwsdk` version by reading its `package.json` from the `node_modules` directory. This check was incompatible with Yarn's Plug'n'Play (PnP) feature, which does not create a conventional `node_modules` folder. The check has been removed to allow tests to run correctly with Yarn PnP.
4.  **Yarn PnP Command Execution**: Tests were failing with a `vite: command not found` error when run with Yarn PnP. This was because the test harness was hardcoded to use `pnpm run dev` to start the dev server, which fails in a PnP environment where binaries are not in `node_modules/.bin`. The `createDevServer` function in `sdk/src/lib/e2e/testHarness.mts` was updated to dynamically use the package manager specified in the `PACKAGE_MANAGER` environment variable, ensuring the correct command (e.g., `yarn run dev`) is used.
5.  **Reverting to `node-modules` Linker for Yarn**: After fixing command execution, a new, more fundamental issue with Yarn PnP emerged. During the dev server startup, the SDK attempts to write intermediate build outputs, such as vendor barrel files for optimized dependencies, into the `node_modules/rwsdk/dist/__intermediate_builds` directory. This is done to keep build artifacts contained within the package. However, this practice is incompatible with Yarn PnP, which treats package directories as read-only and immutable. As a result, the process fails with an `EROFS: read-only filesystem` error.

    As a temporary workaround to unblock testing, the `nodeLinker: node-modules` setting has been restored to the `.yarnrc.yml` configuration in the E2E test environment. This forces Yarn to use a traditional `node_modules` directory, bypassing the PnP filesystem restrictions. A GitHub issue has been created to track the work required to move these intermediate build outputs to a temporary directory, which will enable full PnP compatibility.
