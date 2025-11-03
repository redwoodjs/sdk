# 2025-11-03: Investigate and fix CI failures

## Problem

After I introduced automatic client-side error checking in the end-to-end test harness, several tests started failing in CI. The goal is to get the PR ready to land by temporarily disabling the new check for failing tests so they can be investigated later.

## Plan

1.  Create a worklog to document the investigation and changes.
2.  Analyze CI logs to identify all failing tests.
3.  For each failing test, disable the automatic error checking by setting `checkForPageErrors: false`.
4.  Add a `// todo` comment to each opted-out test to track the need for future investigation.
5.  Summarize findings and changes in this worklog.

## Investigation & Changes

I'm starting by reviewing the provided CI logs and the summary of failures to get a full picture of the issues. Based on this, I'll identify the specific tests that are failing due to the new client-side error checks and patch them to unblock the PR.

Based on the CI logs, I've identified three playgrounds with failing tests and have opted them out of the automatic error checking for now.

-   **`playground/baseui/__tests__/e2e.test.mts`**: The tests `renders Base UI playground without errors` and `interactive components work correctly` were failing in the deployment environment due to errors fetching JavaScript assets. I've added `checkForPageErrors: false` to both `testDevAndDeploy` calls.

-   **`playground/useid-test/__tests__/e2e.test.mts`**: The test `mixed page maintains server IDs and hydrates client IDs consistently` was also failing in deployment with asset loading errors. I've disabled error checking for this test.

-   **`playground/database-do/__tests__/e2e.test.mts`**: The `allows adding and completing todos` test was failing in the dev server, pointing to an issue with Vite's dependency pre-bundling (`504 (Outdated Optimize Dep)`). I've disabled error checking here as well.

These changes should resolve the immediate CI failures and allow the PR to proceed. The underlying issues are marked with `todo` comments for future investigation.
