# Fix Release Smoke Test Project Path

## Problem

The release script fails during the smoke test phase with the error `projectDir is required for smoke tests`. This happens because the `release.sh` script no longer provides a `--path` argument to `pnpm smoke-test`, so the smoke test runner doesn't know which project to use for testing.

## Plan

The solution is to make the smoke test script default to using the `starter` project when no `projectDir` is explicitly provided.

1.  **Update `smoke-test.mts`**:
    - Modify `sdk/sdk/src/scripts/smoke-test.mts` to calculate the path to the `starter` directory.
    - Set this path as the default value for `projectDir` in the `SmokeTestOptions`. This default will be used when the `--path` argument is not supplied, as is the case when run from `release.sh`.
