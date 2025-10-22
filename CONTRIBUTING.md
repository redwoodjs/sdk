# Contributing

This document provides context on contributing to the SDK.

For context on how the system works, check out the [architecture documents](./docs/architecture/).

## Getting Started

1.  Make sure you have [Node.js](https://nodejs.org) (>=22) installed.
2.  This project uses [pnpm](https://pnpm.io) as a package manager, which is managed using [Corepack](https://nodejs.org/api/corepack.html). Enable Corepack by running:
    ```sh
    corepack enable
    ```
3.  Install dependencies from the root of the `sdk` directory:

```sh
pnpm install
```

## Project Structure

This repository is a monorepo containing several key parts:

-   `sdk/`: This is the heart of the project. It contains the source code for the `rwsdk` npm package. When you're working on the core SDK functionality, this is where you'll spend most of your time. **All commands for building, testing, or formatting the SDK should be run from within this directory.**
-   `starter/`: This directory holds the template project that users can create with `create-rwsdk`. It is used for testing and demonstrating features.
-   `docs/`: Contains the user-facing documentation for the SDK, which is published as a website.
-   `docs/architecture/`: A special section within the docs that contains in-depth architecture documents. These explain the "why" behind key design decisions and provide context on how the system works under the hood. If you're making a significant change, you should read these. If you're changing the system in a significant way, check whether these docs need revising to account for the update.

## Building

To build the `rwsdk` package, run the following command from the root of the `sdk` directory:

```sh
pnpm --filter rwsdk build
```

## Testing

To run the full test suite for the `rwsdk` package, navigate to the `sdk` directory and run the `test` script:

```sh
cd sdk
pnpm test
```

When working on a specific feature, you'll often want to run tests only for the files you're changing. To run tests for a single file, you can pass the path to that file to `pnpm test`.

For example, to run tests for `transformJsxScriptTagsPlugin.test.mts`:

```sh
# from within the sdk/ directory
pnpm test -- src/vite/transformJsxScriptTagsPlugin.test.mts
```

If you make changes that affect test snapshots, you'll need to update them. You can do this by adding the `-u` flag.

```sh
# from within the sdk/ directory
pnpm test -- -u src/vite/transformJsxScriptTagsPlugin.test.mts
```

Note the extra `--` before the `-u` flag. This is necessary to pass the flag to the underlying test runner (`vitest`) instead of `pnpm`.

### Testing Strategy

This project employs a multi-layered testing strategy to ensure code quality and stability. Tests are divided into three main categories, and our CI/CD pipeline runs different test suites depending on the context to balance development velocity with release confidence.

#### Overview of Testing Layers

1.  **Unit Tests**: These are the foundation of our testing pyramid. They verify the correctness of individual functions, modules, and components in isolation. They are fast, focused, and should cover as much of the core logic as possible.
2.  **Smoke Tests**: These tests verify the critical user paths and core functionalities of our starter application. A smoke test ensures that a user can successfully install the SDK, start the dev server, build a production version, and see the application render correctly. They are designed to catch major regressions in the end-to-end user experience.
3.  **End-to-End (E2E) Tests**: Running in the `playground`, these tests cover more nuanced, real-world user scenarios. They validate compatibility with other libraries (like UI frameworks), test specific features in a realistic application context, and confirm compatibility across different environments.

#### CI/CD Testing Pipeline

Our GitHub Actions workflows are configured to provide a tiered testing strategy to balance rapid feedback with comprehensive coverage.

*   **On Pull Requests and Pushes to `main`**: To provide fast feedback, we run a lightweight but representative subset of our test suite. This includes all **unit tests**, plus a minimal configuration of our **smoke tests** and **E2E tests** (running on `ubuntu-latest` with `npm`). This serves as a quick health check to catch common regressions.

*   **Nightly Runs**: To ensure broad compatibility, the full test matrix is run on a schedule (every 12 hours). This includes **smoke tests** and **E2E tests** across all supported operating systems (Ubuntu, macOS) and package managers (pnpm, npm, yarn, yarn-classic). These scheduled runs use more lenient timeouts and higher test retry counts to aggressively surface intermittent, flaky issues that may not appear in regular CI runs. This process catches environment-specific issues without blocking development on `main`.

All test suites can also be run manually on any branch using the `workflow_dispatch` trigger in GitHub Actions, giving contributors the power to run the full suite on their changes when needed.

### Smoke Testing

Smoke tests check that the critical paths of the SDK work for a new project. They perform a full lifecycle test: installing dependencies, running the dev server, and creating a production build. For both dev and production environments, they verify that server and client components render correctly and that actions work as expected.

#### Running Smoke Tests Locally

To run smoke tests for a starter project, you can use the `ci-smoke-test.sh` script. This is the same script that runs in our CI environment.

```sh
# Run smoke test for the starter with pnpm
./sdk/scripts/ci-smoke-test.sh --package-manager "pnpm"
```

The script will create a temporary directory, copy the starter, install dependencies using the specified package manager, and run a series of automated checks using Puppeteer. If the test fails, artifacts (including screenshots and logs) will be saved to a `smoke-test-artifacts` directory in the monorepo root.

### End-to-End Tests (Playground)

The monorepo includes a `playground` directory for end-to-end (E2E) tests. These tests run against a real, packed tarball of the SDK in an isolated environment to simulate a user's project accurately.

Playground examples are self-contained, runnable projects designed to demonstrate and test RedwoodSDK features. Each example, modeled after `playground/hello-world`, must include an `__tests__` directory with end-to-end tests. These tests are executed from the monorepo root. For context on using the framework to build playgroud examples refer to our docs in `docs/src/content/docs`. Run the tests from monorepo root, `e.g: pnpm test:e2e -- playground/hello-world/__tests__/e2e.test.mts`

#### Best Practices

The following is an annotated example of a good E2E test that follows our best practices.

```typescript
import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

// This sets up the test environment for the entire file.
// It ensures the playground is isolated and cleaned up automatically.
setupPlaygroundEnvironment(import.meta.url);

// In most cases, you should be checking the behaviour being tested both in dev and deployments
// Use `testDevAndDeploy` to run the same test logic against both the
// local dev server and a temporary Cloudflare deployment.
testDevAndDeploy("renders MDX and client component", async ({ page, url }) => {
  await page.goto(url);

  // Use helper functions to improve legibility and reduce repetition.
  const getButton = async () => page.waitForSelector("button");
  const getButtonText = async () =>
    await page.evaluate((el) => el?.textContent, await getButton());
  const getPageContent = async () => await page.content();

  // Use `poll` to wait for an element or content to appear.
  // This should be used whenever possible over arbitrary waits (e.g. `setTimeout`).
  // Place your assertion directly inside the poll to avoid redundant checks.
  await poll(async () => {
    const content = await getPageContent();
    expect(content).toContain("Hello world");
    expect(await getButtonText()).toBe("Clicks: 0");
    return true;
  });

  // Before interacting with the page, wait for it to be fully loaded and
  // interactive by calling `waitForHydration`. This ensures client-side
  // hydration is complete and event listeners are attached.
  await waitForHydration(page);

  // Re-fetch the element before interacting with it. The DOM may have been
  // updated by a client-side render, and holding onto a stale element
  // reference can cause flaky tests.
  (await getButton())?.click();

  // Poll again to wait for the result of the interaction.
  await poll(async () => {
    const buttonText = await getButtonText();
    expect(buttonText).toBe("Clicks: 1");
    return true;
  });
});
```

#### Getting Started

Before running deployment tests, you need to authenticate with Cloudflare. You only need to do this once for the entire monorepo.

1.  **Set up Wrangler authentication**:
    ```sh
    pnpm setup:e2e
    ```
    This script will log you in to Cloudflare and ensure the authentication cache is properly set up for all playground tests to reuse.

#### Running Tests

To run all playground E2E tests, use the `test:e2e` script from the monorepo root:

```sh
pnpm test:e2e
```

To run a specific test file, pass its path to the `test:e2e` script. The path can be absolute or relative to the `playground/` directory. Note the `--` before the path, which is necessary to pass the argument to the underlying test runner (`vitest`).

```sh
# Run tests for a single playground project from the monorepo root
pnpm test:e2e hello-world/__tests__/e2e.test.mts
```

You can also specify a package manager or enable debug logging using environment variables:

```sh
# Run tests for hello-world with Yarn and enable debug logging for the e2e environment
PACKAGE_MANAGER="yarn" DEBUG='rwsdk:e2e:environment' pnpm test:e2e hello-world/__tests__/e2e.test.mts
```

#### Local Development Performance

To speed up the local test-and-debug cycle, the E2E test harness uses a caching mechanism that is **enabled by default** for local runs.

-   **How it Works**: The harness creates a persistent test environment in your system's temporary directory for each playground project. On the first run, it installs all dependencies. On subsequent runs, it reuses this environment, skipping the lengthy installation step. The cache is automatically disabled in CI environments.
-   **Disabling the Cache**: If you need to force a clean install, you can disable the cache by setting the `RWSDK_E2E_CACHE` environment variable to `0`:
    ```sh
    RWSDK_E2E_CACHE=0 pnpm test:e2e
    ```
-   **Cache Invalidation**: If you change a playground's `package.json`, you will need to manually clear the cache for that playground to force a re-installation. The cache directories are located in your system's temporary folder (e.g., `/tmp/rwsdk-e2e-cache` on Linux).

#### Skipping Tests

You can skip dev server or deployment tests using environment variables. This is useful for focusing on a specific part of the test suite.

-   **Skip Dev Server Tests**:
    ```sh
    RWSDK_SKIP_DEV=1 pnpm test:e2e
    ```
-   **Skip Deployment Tests**:
    ```sh
    RWSDK_SKIP_DEPLOY=1 pnpm test:e2e
    ```

#### Test API

The E2E test harness provides a set of high-level and low-level APIs to make writing tests simple and efficient.

##### High-Level APIs

These are the most common APIs you'll use. They automatically handle setting up and tearing down resources like dev servers, deployments, and browsers.

-   `testDevServer(name, testFn)`: Runs a test against a local dev server.
-   `testDeployment(name, testFn)`: Runs a test against a temporary Cloudflare deployment.

Both functions also have a `.skip` method for skipping individual tests (e.g., `testDevServer.skip(...)`).

**Example:**

```typescript
// playground/hello-world/__tests__/e2e.test.mts
import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevAndDeploy,
  testDev,
  testDeploy,
  poll,
} from "rwsdk/e2e";

// Sets up the test environment for the suite (automatic cleanup)
setupPlaygroundEnvironment(import.meta.url);

// Test against both dev server and deployment
testDevAndDeploy("renders Hello World", async ({ page, url }) => {
  await page.goto(url);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Hello World");
  });

  const content = await page.content();
  expect(content).toContain("Hello World");
});

// Skip both dev and deployment tests
testDevAndDeploy.skip("skipped test", async ({ page, url }) => {
  // This test will be skipped for both environments
});

// Run only this test (both dev and deployment)
testDevAndDeploy.only("focused test", async ({ page, url }) => {
  // Only this test will run
});

// You can still use individual test functions if needed
testDev("dev-only test", async ({ page, url }) => {
  // This only runs against dev server
});

testDeploy("deployment-only test", async ({ page, url }) => {
  // This only runs against deployment
});
```

##### Lower-Level APIs

For more complex scenarios that require finer control, you can use these lower-level utilities. Note that with these, cleanup is still handled automatically after each test.

-   `setupPlaygroundEnvironment()`: Sets up the isolated, tarball-based test environment for the entire test suite (file).
-   `createDevServer()`: Starts a dev server.
-   `createDeployment()`: Creates a new Cloudflare deployment.
-   `createBrowser()`: Launches a Puppeteer browser instance.
-   `poll(fn, options)`: A utility to retry an async function until it returns `true` or times out.

## Contribution Guidelines

### Dependency Injection over Mocking

When writing tests, we prefer using **dependency injection** over module-level mocking (e.g., `vi.mock()`). [[memory:4223216]] This approach makes our tests more explicit, robust, and easier to maintain.

The preferred pattern is to design functions to accept their dependencies as arguments. This allows you to pass in a controlled, "fake" version of the dependency during tests.

**Example: What Not to Do**

Let's say you have a function that calls `getStylesheetsForEntryPoint`:

```typescript
// in transformJsxScriptTagsPlugin.mts
import { getStylesheetsForEntryPoint } from "./jsEntryPointsToStylesheetsPlugin.mjs";

export async function transformJsxScriptTagsCode(code: string) {
  // ...
  const stylesheets = await getStylesheetsForEntryPoint(entryPoint, context);
  // ...
}
```

A test for this might be tempted to use `vi.mock()`:

```typescript
// in transformJsxScriptTagsPlugin.test.mts
import { getStylesheetsForEntryPoint } from "./jsEntryPointsToStylesheetsPlugin.mjs";

vi.mock("./jsEntryPointsToStylesheetsPlugin.mjs", () => ({
  getStylesheetsForEntryPoint: vi.fn().mockResolvedValue(["/src/styles.css"]),
}));

test("injects stylesheets", async () => {
  // ...
});
```

**Example: The Preferred Pattern**

Instead, refactor `transformJsxScriptTagsCode` to accept `getStylesheetsForEntryPoint` as an argument with a default value for production use.

```typescript
// in transformJsxScriptTagsPlugin.mts
import {
  getStylesheetsForEntryPoint as realGetStylesheetsForEntryPoint,
} from "./jsEntryPointsToStylesheetsPlugin.mjs";

export async function transformJsxScriptTagsCode(
  code: string,
  // ... other args
  getStylesheetsForEntryPoint = realGetStylesheetsForEntryPoint,
) {
  // ...
  const stylesheets = await getStylesheetsForEntryPoint(entryPoint, context);
  // ...
}
```

Now, your test can simply pass a fake function directly, making the dependency explicit and the test cleaner:

```typescript
// in transformJsxScriptTagsPlugin.test.mts
test("injects stylesheets for src entry point", async () => {
  const code = `...`;
  const getStylesheetsForEntryPoint = async (entryPoint: string) => {
    if (entryPoint === "/src/client.tsx") {
      return ["/src/styles.css"];
    }
    return [];
  };

  const result = await transformJsxScriptTagsCode(
    code,
    // ... other args
    getStylesheetsForEntryPoint,
  );
  // ... assertions
});
```

This approach makes dependencies clear, avoids the pitfalls of global mocks, and leads to more resilient tests.

### Options Objects for Function Parameters

For functions that accept multiple arguments, prefer using a single options object instead of a long list of parameters. This improves readability and makes the function signature more maintainable, as new options can be added without changing the order of existing arguments.

**Good Example:**

```typescript
function processData({ input, retries = 3, logger }: {
  input: string;
  retries?: number;
  logger?: Logger;
}) {
  // ...
}
```

**Bad Example:**

```typescript
function processData(input: string, retries: number = 3, logger?: Logger) {
  // ...
}
```

This convention is not a strict rule. For simple functions where the arguments are self-explanatory (e.g., `add(a, b)`), positional arguments are perfectly acceptable. Use your best judgment.

## Formatting

This project uses Prettier for code formatting. To format the code, run:

```sh
pnpm format
```

## Dependency Management and Greenkeeping

This section outlines the strategy for managing dependencies to maintain stability for users while keeping the SDK's own dependencies up-to-date.

### Guiding Principles

1.  **User Stability First**: Changes to peer dependencies, which directly impact user projects, must be handled with the utmost care. We should never knowingly publish a version of the SDK that allows a broken peer dependency version range.
2.  **Automation with Control**: We use automation to handle routine updates, but maintain manual control over merging and releasing, especially for changes that affect peer dependencies.
3.  **Clear Categorization**: We treat different types of dependencies with different protocols based on their potential impact.

### Dependency Categories and Update Cadence

#### 1. Peer Dependencies (`starter-peer-deps`)

-   **What**: The most critical dependencies (`wrangler`, `react`, `vite`, etc.) that are defined as `peerDependencies` in the SDK and tested in the `starters/*`, `playground/*`, and `addons/*` projects.
-   **When**: As Soon As Possible (ASAP). Renovate creates a PR immediately when a new version is available.
-   **Why**: To provide an immediate early-warning signal if a new peer dependency version introduces a regression that could affect users. The playground E2E tests provide an additional validation layer beyond the starter smoke tests.

##### A Note on React Canary Versions
The starters intentionally use `canary` versions of React. This is the official channel recommended by the React team for frameworks that implement React Server Components. Using canaries gives us access to the latest features and ensures our implementation remains compatible with the direction of React.

To manage these potentially unstable versions, Renovate is specifically configured to track React's `next` distribution tag on npm. This provides a more reliable signal for the latest available canary version than tracking the `canary` tag directly, which can be more volatile.

#### 2. SDK Internal Dependencies (`sdk-internal-deps`)

-   **What**: The SDK's own `dependencies` and `devDependencies` from `sdk/package.json`.
-   **When**: Weekly, in a single grouped pull request.
-   **Why**: To keep the SDK's own build tooling and internal dependencies up-to-date in a predictable, non-disruptive manner.

#### 3. Starter Application Dependencies (`starter-deps`)

-   **What**: All non-peer dependencies in the `starters/*` projects.
-   **When**: Weekly, in a single grouped pull request.
-   **Why**: To ensure our starter templates remain current with their own dependencies.

#### 4. Repository, Docs, and Infrastructure Dependencies (`docs-and-infra-deps`)

-   **What**: A consolidated group for all remaining repository maintenance dependencies. This includes dependencies from the root `package.json`, `docs/package.json`, non-peer dependencies from `playground/*` and `addons/*` projects (such as `vitest`), GitHub Actions, Docker images, and the `.node-version` file.
-   **When**: Weekly, in a single grouped pull request.
-   **Why**: To bundle all miscellaneous tooling, documentation, and infrastructure updates into one convenient PR to reduce noise.

### Using the Dependency Dashboard

After a new dependency update is available, Renovate will create a Pull Request. For managing all available updates, Renovate also creates a special issue in the repository titled "Dependency Dashboard". You can find this in the "Issues" tab.

This dashboard is the central place to manage the greenkeeping process. It provides:
*   A list of all new dependency versions that have been discovered.
*   The status of current open Pull Requests for dependency updates.
*   A list of updates that are waiting for their scheduled time to run.

#### Manually Triggering Updates

Our configuration schedules most updates to run weekly to reduce noise. However, you can trigger any scheduled update immediately from the dashboard.

To do this, find the update group you wish to run in the "Awaiting Schedule" section of the dashboard and click the checkbox next to it. Renovate will detect this change and create the corresponding Pull Request within a few minutes. This is particularly useful for forcing a one-time update of all dependencies to establish a new baseline or to test a specific update, such as the `starter-peer-deps` group.

### Failure Protocol for Peer Dependencies

When the smoke tests or playground E2E tests fail on a peer dependency update, it is a signal that requires manual intervention.

1.  **Maintainer Investigation**: The first step is always for a maintainer to investigate **why** the test is failing. The failure can have one of two root causes:
    *   **An Issue in Our SDK**: The dependency may have introduced a breaking change that we need to adapt to.
    *   **A Regression in the Dependency**: The dependency may have a legitimate bug or regression.

2.  **Manual Corrective Action**:
    *   If the issue is in our SDK, a fix should be implemented and pushed directly to the failing Renovate PR branch.
    *   If the failure is a regression in the dependency itself, a maintainer must perform the following steps **on the Renovate PR branch**:
        1.  **Revert Dependency in Starters and Playground**: In the `starters/*/package.json` and `playground/*/package.json` files, revert the version of the failing dependency back to the last known good version.
        2.  **Constrain Peer Dependency**: In `sdk/package.json`, update the `peerDependencies` entry for the package to add an upper bound that excludes the broken version (e.g., change `^1.2.3` to `>=1.2.3 <1.2.4`).
        3.  **Commit and Push**: Commit these changes with a message explaining the reason for the constraint and push to the branch.

    *   Once CI passes on the PR, it can be merged. This prepares for a patch release of `rwsdk` that protects users from the faulty dependency.

## Debugging changes to the sdk locally for a project

The `rwsync` command provides a bridge between a local checkout of the `rwsdk` and a project that uses it, enabling a fast and efficient development workflow.

First, set the `RWSDK_REPO` environment variable in your shell's configuration file (e.g., `~/.bashrc`, `~/.zshrc`) to point to the absolute path of your local `sdk` repository checkout.

```sh
# e.g. in ~/.zshrc
export RWSDK_REPO=/path/to/your/local/sdk
```

Then run this in your project's root to sync changes to your `sdk` checkout into your project:

```sh
cd /path/to/project/
pnpm install # you need to have installed your dependencies first
npx rwsync
```

To keep watching for changes to the `sdk` repo, and rerun a command when this happens, use `--watch`:

```sh
npx rwsync --watch "npm run dev"
```

## Debugging the Vite Plugin

The RedwoodSDK Vite plugin is composed of several smaller, internal plugins. To debug them, you can use the [debug](https://www.npmjs.com/package/debug) package by setting the `DEBUG` environment variable.

Each internal plugin has a unique namespace, like `rwsdk:vite:hmr-plugin`. To enable logging for a specific plugin, set the `DEBUG` variable to its namespace.

For example, to see debug output from just the HMR plugin:
```sh
DEBUG='rwsdk:vite:hmr-plugin'
```

You can also use a wildcard to enable logging for all internal Vite plugins:
```sh
DEBUG='rwsdk:vite:*'
```

For more detailed "verbose" output, set the `VERBOSE` environment variable to `1`.

Here is a full example command that enables verbose logging for the HMR plugin, starts `rwsync` in watch mode to sync your local SDK changes with a test project, and redirects all output to a log file for analysis:
```sh
VERBOSE=1 DEBUG='rwsdk:vite:hmr-plugin' npx rwsync --watch "npm run dev" 2>&1 | tee /tmp/out.log
```

## Forcing re-syncing
Some projects (e.g. ones with lockfiles disabled) have proven challenging for working with the `rwsync`. For these cases, it might work better to force a full sync on each change:

```sh
export RWSDK_FORCE_FULL_SYNC=1
npx rwsync --watch "npm run dev"
```

## Releasing (for Core Contributors)

Releases are managed by a series of automated GitHub Actions workflows that handle versioning, smoke testing, publishing to npm, and packaging of release artifacts for the SDK, starter, and addons.

For a complete, in-depth explanation of the entire end-to-end release process, please refer to the architecture document: [`docs/architecture/sdkStarterAndAddonReleaseProcess.md`](./docs/architecture/sdkStarterAndAddonReleaseProcess.md).

### How to Create a Release

1.  Navigate to the [Release workflow](.github/workflows/release.yml) in the repository's "Actions" tab.
2.  Click the "Run workflow" dropdown.
3.  Choose the `version_type` for the release:
    *   `patch` or `minor` for standard releases.
    *   `test` for internal test builds.
    *   `explicit` for major or pre-releases (requires filling in the `version` field).
4.  Click the "Run workflow" button.

This action triggers the entire release pipeline as described in the architecture document.

### How to Unrelease a Version

A separate, manually-triggered workflow exists to unrelease a version.

1.  Navigate to the [Unrelease workflow](.github/workflows/unrelease.yml) in the repository's "Actions" tab.
2.  Click the "Run workflow" dropdown.
3.  Enter the full `version` to unrelease (e.g., `0.1.15`).
4.  Provide a `reason` for the action.

Running this workflow does the following:
*   Deprecates the specified package version on npm. This acts as a warning to users that the version should not be used, without removing it from the registry. A warning message with the provided reason is shown when the version is installed.
*   Deletes the corresponding GitHub Release. If the deleted release was marked as "latest," the workflow automatically finds the most recent stable release and promotes it to "latest".
*   Deletes the corresponding git tag from the remote repository.

### Creating a Test Release from a Branch
Sometimes you have changes made in your branch and would like to test them out or share them with others before making a new release. To create a test release from a branch to test changes:

1.  In the GitHub UI, navigate to the [Release workflow](.github/workflows/release.yml).
2.  From the "Use workflow from" dropdown, select the branch with the changes you want to test.
3.  Choose `test` as the `version_type`.
4.  Run the workflow.

The easiest way to get the version string (e.g., `0.1.19-test.20250717130914`) is from the npm email notification. Alternatively, the workflow output will contain a line: `✨ Done! Released version 0.1.19-test.20250717130914`.

Test releases receive special handling. They are published to npm under the `test` tag, but the release commit itself is not pushed to any branch. Instead, the script creates a release commit, tags it, and pushes *only the tag* to the remote. The local branch is then reset to its previous state. This makes the release commit available on the remote, referenced only by its tag, without including it in the main branch history.

#### Why Deprecate Instead of Unpublish?

This project uses `npm deprecate` instead of `npm unpublish` because unpublishing is highly restrictive and can be unreliable in an automated CI environment. The npm registry has strict policies to prevent breaking the package ecosystem:

*   A package version can only be unpublished without restrictions within 72 hours of its release.
*   After 72 hours, unpublishing is only allowed if the package has very few downloads and no other public packages depend on it.

Deprecation is a safer and more reliable method. It immediately warns users about a problematic version while ensuring that existing projects that depend on it do not break.

### Release Process and Sanity Checks

The release workflow and underlying script (`sdk/sdk/scripts/release.sh`) follow a strict procedure to ensure the integrity of every release:

1.  **Version & Commit**: Calculates the new version, updates `package.json`, and creates an initial version commit.
2.  **Build**: The `rwsdk` package is built with `NODE_ENV=production`.
3.  **Pack**: The package is bundled into a `.tgz` tarball using `npm pack`.
4.  **Smoke Test & Verify**: A comprehensive smoke test is run against the packed tarball:
    *   A temporary project is created using the `starter` template.
    *   The `.tgz` tarball is installed as a dependency.
    *   **Verification**: The script verifies that the contents of the `dist` directory in the installed package are *identical* to the local `dist` directory from the build step by comparing checksums.
    *  Smoke tests are then run for this same test project, validating that the installed tarball is working correctly
5.  **Publish**: Only if all smoke tests and verification checks pass, the script publishes the `.tgz` tarball to npm. This guarantees the exact package that was tested is the one that gets published.
6.  **Finalize Commit**: For non-prerelease versions, the script updates dependencies in the monorepo, amends the version commit with these changes, tags the commit, and pushes everything to the remote repository.
7.  **Rollback**: If any step fails, the script reverts the version commit and cleans up all temporary files, leaving the repository in a clean state.

*   **A Note on Mocking**: The term "dependency" is used in two ways. This document primarily concerns package management (e.g., `npm` packages). For guidance on writing testable code by avoiding mocks in favor of dependency injection, please see the "Dependency Injection over Mocking" section.

### Using the Dependency Dashboard

After a new dependency update is available, Renovate will create a Pull Request. For managing all available updates, Renovate also creates a special issue in the repository titled "Dependency Dashboard". You can find this in the "Issues" tab.

This dashboard is the central place to manage the greenkeeping process. It provides:
*   A list of all new dependency versions that have been discovered.
*   The status of current open Pull Requests for dependency updates.
*   A list of updates that are waiting for their scheduled time to run.

#### Manually Triggering Updates

Our configuration schedules most updates to run weekly to reduce noise. However, you can trigger any scheduled update immediately from the dashboard.

To do this, find the update group you wish to run in the "Awaiting Schedule" section of the dashboard and click the checkbox next to it. Renovate will detect this change and create the corresponding Pull Request within a few minutes. This is particularly useful for forcing a one-time update of all dependencies to establish a new baseline or to test a specific update, such as the `starter-peer-deps` group.

### Failure Protocol for Peer Dependencies

If a peer dependency update in a starter project fails the CI smoke tests, it signifies a potential regression. The failure could be due to one of two causes: