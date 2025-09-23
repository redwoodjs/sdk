Running the type check separately was problematic because it would run before the necessary types had been generated. Relying on the `generate` script's built-in type check ensures that types are checked at the correct point in the process, resolving the CI failures.

## PR Description

### Manual Changes and Fixes

This PR includes manual changes to address issues that arose from the automated dependency updates.

#### Problem

The dependency updates, primarily to Vite and its internal esbuild version, introduced several breaking changes and revealed weaknesses in the CI process:

1.  **Build Failures**: An esbuild version bump caused a breaking change in its API, leading to build failures in the directive scanner.
2.  **CI Blind Spots**: The existing CI (`check-starters.yml`) used workspace linking, which masked type inconsistencies and did not accurately simulate a real user's package installation. This allowed type errors related to Vite's updated plugin API to go undetected.
3.  **Brittle Test Environments**: Attempts to improve CI by running `npm run check` in isolated environments failed. This was due to broken `pnpm` symlinks being copied into test directories, which prevented clean dependency installation.
4.  **Code Duplication**: The setup logic for smoke tests and the E2E tests was heavily duplicated, making maintenance difficult.

#### Solution

A series of fixes and refactorings were implemented to resolve these issues and make the testing process more robust:

1.  **Build Fixes**: The esbuild scanner was updated to be compatible with the new API. A TypeScript error in an E2E test file related to `null` values was also corrected.
2.  **Tarball-Based Testing**: The CI process was refactored to use tarball-based installations for E2E and smoke tests. This more accurately reflects a real user environment and successfully caught the underlying type errors.
3.  **Test Environment Refactoring**: The project-copying and environment setup logic for both smoke and E2E tests were consolidated into a single, shared, cross-platform function. This new function correctly excludes `node_modules` to ensure clean dependency installs, resolving the broken symlink issue.
4.  **Simplified Type Checking**: Redundant `npm run check` commands were removed from the test harnesses. The type check that runs as part of the `npm run generate` command is now the single source of truth, ensuring types are checked only after they have been correctly generated.

These changes ensure the codebase is compatible with the updated dependencies and strengthen the CI process to prevent similar issues in the future.
