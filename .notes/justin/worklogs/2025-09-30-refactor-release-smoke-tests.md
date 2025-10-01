# Refactor Release Smoke Tests

## Problem

The release script's smoke test fails because it creates an isolated project where `pnpm` cannot resolve the `rwsdk: "workspace:*"` dependency from the `starter`'s `package.json`. The script also contains redundant logic for setting up a test environment, which is already handled by our e2e/smoke test infrastructure.

## Plan

The plan is to centralize the test environment setup within the existing smoke test infrastructure and adapt it to work with the release script's workflow.

1.  **Modify Test Infrastructure to Accept a Pre-built Tarball**:
    - Update `createSdkTarball` in `src/lib/e2e/environment.mts` to accept a tarball path via an environment variable (`RWSKD_SMOKE_TEST_TARBALL_PATH`).
    - If the variable is present, the function will use the existing tarball instead of creating a new one, and it will not perform any cleanup.

2.  **Centralize Checksum Verification**:
    - Move the checksum verification logic from `scripts/release.sh` into `src/lib/e2e/tarball.mts`.
    - This ensures that the contents of the packed tarball match the local `dist` directory, and this check is now part of the standard smoke test setup.

3.  **Update Release Script**:
    - Remove the manual test environment setup from `scripts/release.sh`.
    - Modify the script to invoke `pnpm smoke-test`, passing the path of the generated tarball through the `RWSKD_SMOKE_TEST_TARBALL_PATH` environment variable.
    - Remove the now-unused `--path` and `--no-sync` arguments from the `pnpm smoke-test` command.

4.  **Clean up smoke test script arguments**:
    - Review `src/lib/smokeTests/release.mts` and remove handling for the `--no-sync` argument.
