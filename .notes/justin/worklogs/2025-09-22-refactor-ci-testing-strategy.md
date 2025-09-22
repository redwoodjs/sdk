## Problem

Our current CI setup for end-to-end and smoke tests is facing significant challenges with flakiness and long execution times. The comprehensive test matrix—covering multiple operating systems (Ubuntu, macOS) and package managers (pnpm, npm, yarn, yarn-classic)—runs for every pull request. This creates a slow, frustrating, and unreliable development feedback loop, which hampers our agility.

As we approach a 1.0 release, we need a testing strategy that balances development velocity with the need for high confidence in our code's stability. The current approach is not sustainable and risks slowing down both development and releases.

## Plan

The proposed solution is to restructure our CI testing strategy by differentiating the test suites run on pull requests from those run on the `main` branch. This will provide fast feedback during development while ensuring that no release can proceed without comprehensive validation. We will follow common conventions established by other successful open-source projects.

### 1. Enhance `README.md` with a Live Status Dashboard

To provide a transparent, at-a-glance view of the project's health, we will add a "CI Status" section to the main `README.md`. This section will contain a matrix of GitHub Actions status badges for every job in the `main` branch workflows, effectively creating a live dashboard.

### 2. Consolidate Testing Documentation in `CONTRIBUTING.md`

All detailed testing documentation will be centralized within `CONTRIBUTING.md`, making it the single source of truth for contributors. This includes:

*   **Overview of Testing Layers:** A clear definition of what each type of test in our suite is responsible for:
    *   **Unit Tests:** Verify the correctness of individual functions and components in isolation.
    *   **Smoke Tests:** Verify the critical user paths and core functionalities of our starter applications (`minimal` and `standard`).
    *   **End-to-End (E2E) Tests:** Verify more nuanced, real-world user scenarios in our `playground` applications, including integrations.
*   **CI/CD Testing Strategy:** A detailed explanation of the CI/CD pipeline, framed for contributors:
    *   **On Pull Requests:** An explanation that a lightweight test suite runs for fast feedback.
    *   **On Pushes to `main`:** An explanation that the full test matrix runs as a release gate, and that all tests must pass for a release to proceed.
*   **Restored Smoke Testing Section:** The accidentally removed section on smoke testing will be restored using its original content from Git history, providing clear instructions on how to run and write these tests.
*   **Clarified E2E Test Instructions:** The existing section on E2E tests will be reviewed and updated for clarity.

### 3. CI Workflow Modifications

We will adjust the `playground-e2e-tests.yml` and `smoke-test-starters.yml` workflows with the following changes:

*   **Job Timeouts:** Each test job will be configured with a 60-minute timeout to prevent stuck runners while allowing ample time for completion.
*   **Dynamic Matrix:** The workflows will execute different test matrices based on the trigger.
*   **Granular On-Demand Runs:** The `workflow_dispatch` trigger will be enhanced with inputs, allowing a contributor to manually run a test for a specific OS, package manager, and starter combination.

#### On Pull Requests (Fast Feedback)
*   **Goal:** Provide a quick sanity check to catch most regressions.
*   **Tests:** A subset of smoke and E2E tests.
*   **Matrix:** A single configuration:
    *   **Starter:** `minimal`
    *   **OS:** `ubuntu-latest`
    *   **Package Manager:** `pnpm`

#### On Pushes to `main` (Release Gate Foundation)
*   **Goal:** Ensure full test coverage to validate the stability of the `main` branch.
*   **Tests:** The complete smoke and E2E test suites.
*   **Matrix:** The full combination:
    *   **Starters:** `minimal` and `standard`
    *   **OS:** `ubuntu-latest`, `macos-latest`
    *   **Package Managers:** `pnpm`, `npm`, `yarn`, `yarn-classic`

### 4. Implement Release Gate

To enforce the release-gating strategy, the `release.yml` workflow will be modified. A new job will be added at the beginning of the release process to verify that the last runs of the `smoke-test-starters.yml` and `playground-e2e-tests.yml` workflows on the `main` branch were successful. If either of these checks fails, the release process will be halted immediately.

---

## Implementation Summary

I have now implemented the plan outlined above. Here is a summary of the changes:

### CI Workflows (`smoke-test-starters.yml` & `playground-e2e-tests.yml`)

-   **Dynamic Matrix**: Both workflows were updated to use a `setup-matrix` job. This job outputs a different test matrix depending on the GitHub event. For `pull_request` events, it generates a single-job matrix for a quick sanity check. For `push` events to `main` or default `workflow_dispatch` runs, it generates the full matrix.
-   **Granular Manual Runs**: The `workflow_dispatch` trigger in both workflows was enhanced with `inputs` of `type: choice`. This allows developers to manually trigger a run for any specific combination of OS, package manager, and (for smoke tests) starter project. The `setup-matrix` job was updated with logic to parse these inputs and construct a custom matrix.
-   **Job Timeouts**: A `timeout-minutes: 60` was added to each test job to prevent indefinite hangs.
-   **Success Artifacts**: A final step was added to both workflows to upload a uniquely named success artifact for each job (e.g., `smoke-tests-success-minimal-ubuntu-latest-pnpm`). This step only runs on successful pushes to the `main` branch and provides the mechanism for the release gate.

### Release Gate (`release.yml`)

-   The release workflow was modified to act as a true release gate.
-   Two new jobs, `check-ci-status` and `check-e2e-status`, were added at the beginning of the workflow.
-   These jobs use a `matrix` strategy to iterate through every possible test combination. Each matrix job uses the `dawidd6/action-download-artifact@v3` action to attempt to download the corresponding success artifact from the latest commit on the `main` branch.
-   If any test in the matrix failed on `main`, its success artifact will not exist. The download action will fail, which in turn fails the check job.
-   The `release` job was made dependent on the success of both `check-ci-status` and `check-e2e-status`, ensuring that a release cannot proceed unless the entire test suite was green on `main`.

### Documentation (`CONTRIBUTING.md` & `README.md`)

-   **`CONTRIBUTING.md`**: This file was significantly updated. A "Testing Strategy" section was added to explain the different test layers and the new CI pipeline. The "Smoke Testing" section, which had been accidentally removed, was restored from Git history with clear instructions for running tests locally.
-   **`README.md`**: A "CI Status" section was added. It contains a Markdown table with a matrix of GitHub Actions status badges, providing a live dashboard of the test suite's health on the `main` branch for public visibility.

---

## Implementation Summary

I have now implemented the plan outlined above. Here is a summary of the changes and the reasoning behind the final approach.

### 1. CI Workflow Restructuring (`smoke-test-starters.yml` & `playground-e2e-tests.yml`)

The core of the change was to make the CI feedback loop faster for developers while strengthening the guarantees for releases.

-   **Dynamic Matrix**: Both workflows were updated to use a `setup-matrix` job. This job generates a minimal, single-job test matrix for pull requests, providing fast feedback. For pushes to `main`, it generates the full, comprehensive matrix across all supported OS and package managers.
-   **Granular Manual Runs**: To make on-demand testing easy, the `workflow_dispatch` trigger was enhanced with dropdown `inputs` for OS, package manager, and starter. A developer can now easily trigger a run for any specific combination without needing to run the entire suite.
-   **Job Timeouts**: A `timeout-minutes: 60` was added to each test job to prevent runners from getting stuck.

### 2. Release Gate Implementation (`release.yml`)

The most critical part of this task was creating a reliable release gate. Our approach evolved to a more robust solution:

-   **Initial Idea (Rejected)**: The first concept was to have each of the many matrix jobs upload a "success" artifact, and have the release workflow download all of them. This was rejected because it was brittle; any change to the test matrix would require a corresponding change to the release workflow, making it hard to maintain.
-   **Final Implementation (Query-Based)**: We opted for a much cleaner and more scalable approach. The release workflow now has a single `check-ci-status` job that runs first. This job uses the GitHub CLI (`gh run list`) to query for *all* workflow runs associated with the latest commit on the `main` branch. It then checks their status. If any run has failed or is still in progress, the check job fails, immediately halting the release.

This query-based approach is superior because it automatically scales. If we add new CI workflows in the future, this release gate will automatically include them in its check without requiring any modifications.

### 3. Documentation (`CONTRIBUTING.md` & `README.md`)

-   **`CONTRIBUTING.md`**: This file was updated to be the single source of truth for contributors. It now contains a detailed "Testing Strategy" section explaining the different test layers (Unit, Smoke, E2E) and the new CI pipeline. The restored "Smoke Testing" section provides clear, actionable instructions for running tests locally.
-   **`README.md`**: A "CI Status" section was added, containing a Markdown table with a matrix of GitHub Actions status badges, providing a live, public-facing dashboard of the test suite's health on the `main` branch.

---

## Pull Request Description

### Problem

Running the full test matrix (all OS and package manager combinations for both smoke and E2E tests) on every pull request resulted in a slow and often flaky CI feedback loop.

### Approach

This change refactors the CI strategy to run a smaller suite of tests on pull requests and the full suite on the `main` branch.

1.  **Differentiated CI Pipeline**:
    *   **On Pull Requests**: A minimal subset of smoke and E2E tests runs (Ubuntu with pnpm).
    *   **On `main`**: The full test matrix runs on every push.

2.  **Release Gate**:
    *   The `release` workflow is now gated. It begins with a job that uses the GitHub CLI to query all CI runs associated with the latest commit on `main`.
    *   If any check has failed or is in progress, the release is blocked.

3.  **Manual Test Execution**:
    *   The `smoke-test-starters` and `playground-e2e-tests` workflows now have `workflow_dispatch` inputs. These can be used to manually run tests for specific configurations, since the full matrix no longer runs on pull requests.

4.  **CI Dashboard**:
    *   The `README.md` now includes a "CI Status" section with a matrix of status badges for the test jobs that run on the `main` branch.
