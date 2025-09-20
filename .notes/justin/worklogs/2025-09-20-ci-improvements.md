# CI Improvements - 2025-09-20

## Problem
CI tests are experiencing flakiness and failures across different operating systems and package managers. Currently running on ubuntu-latest only, but need broader OS coverage. Need retry mechanism to handle transient failures.

## Plan
1. Add macOS (macos-latest) to the matrix for both Playground E2E tests and smoke test starters
2. Add fail-fast: false to Playground E2E tests to match smoke tests behavior
3. Create a retry bash script that wraps commands with 3 retry attempts
4. Update both workflows to use the retry script for test execution
5. Verify changes using GitHub CLI

## Context
- Current workflows: `.github/workflows/playground-e2e-tests.yml` and `.github/workflows/smoke-test-starters.yml`
- Both run matrix tests across package managers (pnpm, npm, yarn, yarn-classic)
- Smoke tests already have fail-fast: false, but E2E tests don't
- Need to wrap: `./sdk/scripts/ci-smoke-test.sh` and `pnpm test:e2e`

## Implementation

### Creating retry script
Created `scripts/retry.sh` with 3 retry attempts and 5-second delays between retries. Script takes any command as arguments and wraps it with retry logic.

### Updating workflows
- Added `macos-latest` to the OS matrix in both workflows
- Playground E2E tests already had `fail-fast: false` (no change needed)
- Updated smoke test command to use: `./scripts/retry.sh ./sdk/scripts/ci-smoke-test.sh --starter "${{ matrix.starter }}" --package-manager "${{ matrix.package-manager }}"`
- Updated E2E test command to use: `../scripts/retry.sh pnpm test:e2e`

### Changes made
- `scripts/retry.sh`: New retry wrapper script
- `.github/workflows/smoke-test-starters.yml`: Added macOS, wrapped command with retry
- `.github/workflows/playground-e2e-tests.yml`: Added macOS, wrapped command with retry
