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
