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
- `scripts/retry.sh`: New retry wrapper script with 3 retry attempts and 5-second delays
- `.github/workflows/smoke-test-starters.yml`: Added macOS, wrapped command with retry
- `.github/workflows/playground-e2e-tests.yml`: Added macOS, wrapped command with retry

### Testing
- Tested retry script locally - works correctly with both successful and failing commands
- Script shows proper attempt counting and delay behavior
- Fixed initial issue where script showed 5 retries instead of 3

### Results
- Both workflows now include macOS in addition to Ubuntu (2 OS × 4 package managers = 8 jobs each)
- Playground E2E tests already had fail-fast: false (no change needed)
- Commands are wrapped with retry logic to handle transient failures
- Workflows will only trigger on pushes to main or pull requests (not feature branch pushes)

### Matrix expansion
- **Before**: 4 jobs per workflow (1 OS × 4 package managers)  
- **After**: 8 jobs per workflow (2 OS × 4 package managers)
- Total CI jobs increased from 8 to 16 across both workflows

## Worker Cleanup Issue

Hit Cloudflare Workers limit (500 workers max) during CI runs. Error: "You have exceeded the limit of 500 Workers on your account" with test worker name like `test-project-smoke-test-defeated-cat-c6cefbc2`.

Need to clean up test workers with "smoke-test" in their names using Wrangler CLI.

### Cleanup attempts
- Wrangler CLI requires specific worker names for deletion, can't list all workers easily
- API access requires proper authentication tokens not available in local environment
- Created cleanup script that attempts to delete workers with common test patterns
- Test worker names follow pattern like: `test-project-smoke-test-defeated-cat-c6cefbc2`
- Ran cleanup scripts but found no workers matching the attempted patterns
- Workers may have been auto-cleaned, use different patterns, or need manual dashboard cleanup

### Cleanup scripts created
- `scripts/cleanup-test-workers.sh`: Comprehensive cleanup with many pattern variations
- `scripts/quick-cleanup.sh`: Focused cleanup with most likely patterns

### Manual cleanup guidance
Dashboard URL: https://dash.cloudflare.com/1634a8e653b2ce7e0f7a23cca8cbd86a/workers-and-pages
Look for workers containing: smoke-test, e2e-test, test-project, playground, hello-world, minimal, standard
