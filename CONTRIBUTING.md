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
-   `starters/`: This directory holds the template projects, like `minimal` and `standard`, that users can create with `create-rwsdk`. These are used for testing and demonstrating features.
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

## Smoke Testing

For details on how to run smoke tests, please see the [smoke testing documentation](./SMOKE-TESTING.md).

## Formatting

This project uses Prettier for code formatting. To format the code, run:

```sh
pnpm format
```

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

Releases are managed by a GitHub Actions workflow that automates versioning, publishing, and dependency updates.

### How to Create a Release

1.  Navigate to the [Release workflow](.github/workflows/release.yml) in the repository's "Actions" tab.
2.  Click the "Run workflow" dropdown.
3.  Choose the `version_type` for the release. The options are:
    *   `patch`, `minor`, `major`: For standard releases.
    *   `prepatch`, `preminor`, `premajor`: For pre-releases (e.g., `1.0.0-alpha.0`).
    *   `test`: For internal test releases. These are tagged with `test` on npm and are not considered "latest".
4.  If you are creating a pre-release, you can specify a `preid` (e.g., `beta`, `rc`). The default is `alpha`.
5.  Click the "Run workflow" button.

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
    *   A temporary project is created using the `starters/minimal` template.
    *   The `.tgz` tarball is installed as a dependency.
    *   **Verification**: The script verifies that the contents of the `dist` directory in the installed package are *identical* to the local `dist` directory from the build step by comparing checksums.
    *  Smoke tests are then run for this same test project, validating that the installed tarball is working correctly
5.  **Publish**: Only if all smoke tests and verification checks pass, the script publishes the `.tgz` tarball to npm. This guarantees the exact package that was tested is the one that gets published.
6.  **Finalize Commit**: For non-prerelease versions, the script updates dependencies in the monorepo, amends the version commit with these changes, tags the commit, and pushes everything to the remote repository.
7.  **Rollback**: If any step fails, the script reverts the version commit and cleans up all temporary files, leaving the repository in a clean state.