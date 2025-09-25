# Work Log: Tiered E2E Testing Strategy

**Date:** 2025-09-25

## Problem

The current CI setup runs the full matrix of end-to-end (E2E) and smoke tests on every commit to `main`. This has led to several issues:
- **Slow Feedback:** The full matrix takes a long time to complete (around 20 minutes).
- **Flakiness:** Flaky tests in one configuration can block all development and releases, making it difficult to determine the true health of the `main` branch.
- **Noise:** The high volume of runs and occasional failures creates noise, making it hard to distinguish between genuine regressions and transient issues.

The goal is to refactor the CI process to provide faster, more reliable feedback while still ensuring comprehensive test coverage across all supported environments.

## Plan

I am going to implement a tiered testing strategy:

1.  **Tier 1: Quick Feedback on `main` and PRs.**
    - For pushes to `main` and all pull requests, run a small, representative subset of the E2E and smoke tests.
    - This "canary" suite will use `ubuntu-latest` with `npm`, as this package manager has proven to be a good indicator of dependency issues.
    - The release process will no longer be blocked by CI checks; the `check-ci-status` job will be removed from the `release` workflow to leave the final release decision to the operator.

2.  **Tier 2: Comprehensive Coverage via Scheduled Runs.**
    - A "nightly" GitHub Actions workflow will run the *full* test matrix.
    - This workflow will run on a schedule (every 12 hours).
    - This ensures that platform-specific bugs are still caught in a timely manner without blocking development.

This approach will separate the immediate feedback loop from the comprehensive, but slower, matrix testing.
