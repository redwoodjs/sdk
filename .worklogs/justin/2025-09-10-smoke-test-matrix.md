# Work Log: Smoke Test Matrix

- **Date:** 2025-09-10
- **Author:** Justin

## Problem

The existing smoke test suite was limited, running tests only with `pnpm` on a single operating system (Ubuntu). This created a gap in quality assurance, as it did not validate the framework's behavior across different package managers (`npm`, `yarn`) or on other operating systems like Windows. To ensure broader compatibility and prevent environment-specific bugs, the test suite needed to be expanded.

## Plan

The plan was to refactor the smoke testing infrastructure to support a matrix of configurations. This involved three main steps:

1.  **Parameterize the Package Manager:** Abstract the hardcoded `pnpm` command in the test scripts to allow for dynamic selection of a package manager.
2.  **Update the CLI:** Add a command-line argument to the smoke test runner script to specify which package manager to use for a given test run.
3.  **Implement a CI Matrix:** Modify the GitHub Actions workflow to execute the smoke tests across a matrix of operating systems (`ubuntu-latest`, `windows-latest`) and package managers (`pnpm`, `npm`, `yarn`, `yarn-classic`).

## Implementation

The plan was executed as follows:

1.  **`types.mts`:** The `SmokeTestOptions` interface was updated with a new `packageManager` property, and a `PackageManager` type was defined to ensure type safety for the supported managers.

2.  **`environment.mts`:** The `installDependencies` function was modified to accept the `packageManager` option. It now uses a lookup object to determine the correct installation command (`pnpm install`, `npm install`, `yarn`), making the process manager-agnostic.

3.  **`smoke-test.mts`:** The CLI script was updated to parse a new `--package-manager` argument. This allows for passing the desired package manager from the CI workflow down into the test environment setup.

4.  **`.github/workflows/smoke-test-starters.yml`:** The workflow file was significantly refactored. The two separate jobs for "minimal" and "standard" starters were consolidated into a single job using a `strategy.matrix`. This matrix now runs the tests for both starters across both operating systems and all four package managers, creating a comprehensive test suite. The logic for installing dependencies was also updated to handle the setup for each package manager correctly.

This solution provides a scalable and robust testing strategy, ensuring that the framework is validated against a much wider range of development environments.
