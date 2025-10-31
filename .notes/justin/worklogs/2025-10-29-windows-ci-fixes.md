# 2025-10-29: Windows CI Fixes

## Problem

After a series of fixes to get the SDK and E2E tests running on Windows, we're now facing failures in the CI environment. The first error is a Yarn parsing error for `.yarnrc.yml` during E2E tests.

```
Usage Error: Parse error when loading /C:/Users/RUNNER~1/AppData/Local/Temp/tmp-7808-8ZrSK3rGgAdi/import-from-use-client-test-zygotic-hoverfly-e822a55e/.yarnrc.yml; please check it's proper Yaml
```

## Investigation & Fixes

### 1. Invalid YAML in `.yarnrc.yml` on Windows

**Issue:** The E2E test harness programmatically creates a `.yarnrc.yml` file to configure Yarn for the test runs. On Windows, the path to the cache folder is constructed with backslashes (e.g., `C:\...`). When this path is written into the YAML file, the backslashes are not escaped, leading to a parsing error.

**Investigation:** I inspected the code in `sdk/src/lib/e2e/environment.mts` responsible for generating this file. It uses `path.join` to create the `cacheFolder` path, which produces platform-specific separators. The resulting string is then embedded in quotes in the YAML file. The backslashes in the Windows path are being interpreted as escape sequences by Yarn's YAML parser, causing the load to fail.

**Fix:** The solution is to normalize the `cacheFolder` path to use forward slashes, which are universally accepted in YAML files, regardless of the operating system. I will modify the path string before it's written to the file.

### 2. Cross-Platform Environment Variables in `package.json`

**Issue:** The `release` script in the `starter` and all `playground` examples used `RWSDK_DEPLOY=1 wrangler deploy` to signal a production build to the Redwood plugin. This syntax for setting environment variables is not cross-platform and fails on Windows with shells like PowerShell or Command Prompt.

**Investigation:** My first thought was to introduce a dependency like `cross-env` to handle this. However, this would add a new dependency to user projects and felt like a workaround rather than a fundamental solution.

We then explored several alternatives to remove the need for the environment variable altogether:
-   **Using `process.argv`**: This was quickly dismissed as too brittle, as it depends on how Vite is invoked.
-   **Using Vite's `configResolved` hook**: This was also incorrect because the `dev:init` script needs to run *before* other plugins are instantiated, and this hook runs too late in the lifecycle.
-   **Exporting a function from `vite.config.mts`**: This is the idiomatic Vite way to handle command-dependent configuration. It would work but would constitute a significant breaking change for all existing users, forcing them to update their `vite.config.mts` files.

**Solution:** The most elegant and backward-compatible solution came from realizing we could rely on the `NODE_ENV` variable that Vite itself sets very early in its process.

-   Vite sets `NODE_ENV` to `'production'` for builds.
-   Vite sets `NODE_ENV` to `'development'` for the dev server.

This aligns perfectly with our desired behavior: we want to run `dev:init` in any development context, and skip it in any production context. Using `process.env.NODE_ENV !== 'production'` as our condition is more accurate and robust than our previous `RWSDK_DEPLOY` flag. It correctly handles the default cases and also respects any user overrides of `NODE_ENV`.

This change is backward-compatible. For existing users who have `RWSDK_DEPLOY=1` in their scripts, the variable will simply be ignored by the plugin. However, for Windows users, the build was already broken; they will need to remove the variable from their `release` script to get the fix, which is a reasonable expectation. This will be noted for the pull request description.

### 3. Show npm Logs in CI

To get more visibility, I will change the `stdio` option to `"inherit"`. This will stream `npm`'s output directly to the CI logs, allowing me to see exactly which package it might be struggling with or if it's a network issue.

### 4. Hard Link Permission Errors on Windows CI

**Issue:** With caching enabled, the E2E tests on Windows CI are failing with "Permission denied" errors when trying to create hard links for the `pnpm` cache. The `cp -al` command, used for creating a fast, hardlink-based copy of `node_modules`, is failing.

**Investigation:** The errors indicate a problem with file system permissions in the system's temporary directory (`C:\msys64\tmp` in the CI environment). Creating hard links can require specific privileges that may not be available to the CI user. It could also be a cross-volume issue, where the temp directory and the project directory reside on different logical drives, which is a situation where hard links are not allowed.

Although we can create temporary directories for the test projects themselves, the creation of hard links appears to be more restricted.

**Fix:** Instead of relying on the system's temporary directory, which can be unpredictable across different environments, I will change the caching logic to use a directory within the project's root: `.tmp/rwsdk-e2e-cache`. This ensures that the cache resides on the same volume as the project, avoiding cross-device linking issues, and leverages a directory where we are certain to have write permissions.

### 5. Enable E2E Cache in CI

**Issue:** The E2E tests are slow, especially on Windows CI, due to repeatedly installing dependencies. The test harness cache is currently disabled in CI.

**Investigation:** I agree that enabling the cache in CI is a good idea. Looking at the implementation, I found that the cache key generation relies on a shell command (`find . -type f | sort | md5sum`) to create a checksum of the SDK's `dist` directory. This command is not cross-platform and would fail on Windows, which is likely why the cache was disabled in CI environments in the first place. This is also probably why my previous change to show `npm` logs didn't produce any output for `npm` tests: the process was failing silently on this checksum command when caching was enabled locally for `npm` runs.

**Fix:** I will replace the shell command with a Node.js implementation that recursively traverses the directory, reads file contents, and generates an MD5 hash. This will be cross-platform. With this fixed, I can then enable the cache by default for all environments, including CI. I'll also update the contributing guide to reflect this change.

### 6. Invalid Cross-Device Link Errors on Windows CI

**Issue:** After moving the cache directory into the project root, the tests still fail on Windows with "Invalid cross-device link" errors.

**Investigation:** The logs show that while the cache is now located at `D:\a\sdk\sdk\sdk\.tmp\rwsdk-e2e-cache`, the temporary directories for the test projects are still being created in the system's default temporary directory (`C:\msys64\tmp`). The `cp -al` command fails because it cannot create hard links between two different drives (C: and D:).

**Fix:** To resolve this, I will modify the test harness to create the temporary project directories within the project root as well, specifically under `<ROOT>/.tmp/e2e-projects`. This will ensure that both the cache and the test projects reside on the same volume, allowing hard links to be created successfully.

### 7. `node_modules` Disappearing After Install

**Issue:** The `ENOENT` error persists even with the diagnostic delay, which disproves the initial race condition theory.

**Investigation:** The logs confirm that dependency installation completes successfully, but the `node_modules` directory is gone by the time the caching step begins. This is extremely strange behavior. To get to the bottom of this, I need to add more aggressive logging to trace the lifecycle of the `node_modules` directory.

**Fix:** I will add two key pieces of diagnostic logging. First, immediately after the `npm install` command completes, I will add a check to confirm that the `node_modules` directory exists. Second, right before the caching logic attempts to copy the directory, I will add a command to list the contents of the temporary project directory. This will show us if `node_modules` is being deleted somewhere between the end of the installation and the start of the caching, which should help us finally pinpoint the cause of this issue.

### 11. Probing `npm`'s Behavior on Windows CI

**Issue:** The diagnostic logging confirms that `node_modules` does not exist after the installation command successfully completes.

**Investigation:** This is highly unusual behavior. The package manager exits with a success code but does not produce the expected `node_modules` directory. This suggests a silent failure or an environment-specific quirk on the Windows CI runner. Standard debugging is not providing enough information.

**Fix:** To get a different signal, I will conduct an experiment. Before running `npm install`, I will manually create a dummy `node_modules` directory containing a placeholder file (`_probe.txt`). After the installation command finishes, I will check for the existence of this dummy file. This will tell us if `npm` is deleting the directory before it runs (the file will be gone) or if it's simply skipping the installation entirely (the file will remain, and the directory will be otherwise empty). This should give us a much clearer insight into the package manager's behavior.

### 12. Force `pnpm` to Recognize Temporary Project

**Issue:** The `ENOENT` error persists even with the diagnostic delay, which disproves the initial race condition theory.

**Investigation:** The logs confirm that dependency installation completes successfully, but the `node_modules` directory is gone by the time the caching step begins. This is extremely strange behavior. To get to the bottom of this, I need to add more aggressive logging to trace the lifecycle of the `node_modules` directory.

**Fix:** To solve this, I will force `pnpm` to recognize the temporary project as a standalone workspace. I will modify the test harness to create a `pnpm-workspace.yaml` file at the root of the temporary project directory. This will prevent `pnpm` from traversing up the directory tree, ensuring it installs dependencies locally as intended.

### 13. Replace Unix-Specific Shell Commands

**Issue:** The E2E tests are still failing on Windows, this time with a "dist/ directory not found" error. This is happening because the checksum verification for the packed tarball is failing.

**Investigation:** The `verifyPackedContents` function in `tarball.mts` and the cache creation logic in `environment.mts` are using Unix-specific shell commands (`find`, `md5sum`, `cp -al`). These commands are not available on the Windows CI runners, which is causing the verification to fail and preventing the tests from running.

**Fix:** I will replace all Unix-specific shell commands with their cross-platform Node.js equivalents. I will update `verifyPackedContents` to use the existing `getDirectoryHash` function, which is already cross-platform. I will also replace the `cp -al` command with a call to `fs-extra`'s `copy` function, which will handle the file copying in a way that works on all operating systems.

### 14. Isolate Temporary Directory from Monorepo

**Issue:** `pnpm` is detecting the monorepo's workspace configuration because the temporary directory for tests is created inside the project's root directory. This causes `pnpm` to skip dependency installation.

**Investigation:** The user correctly identified that `pnpm`'s behavior of walking up the directory tree is the root cause.

**Fix:** To prevent this, the temporary directory will be created *outside* the project's root, at the same level (e.g., `<parent_dir>/.tmp-rwsdk`). This is accomplished by modifying the centralized `ensureTmpDir` utility. This isolates the test environment from the monorepo, ensuring `pnpm` performs a clean installation, while keeping the temporary directory on the same drive to prevent cross-device link errors.

### 6. Final `tmpdir` Cleanup in E2E Harness

**Issue:** After several rounds of fixes, there are still remaining references to `os.tmpdir()` in the E2E test harness, specifically in `testHarness.mts` and `browser.mts`, which continue to cause cross-device link errors.

**Investigation:** A targeted review of the `sdk/src/lib/e2e` directory revealed the remaining instances that were missed.

**Fix:** I will now perform a focused update to replace the remaining uses of `os.tmpdir()` in `sdk/src/lib/e2e/testHarness.mts` and `sdk/src/lib/e2e/browser.mts` with our centralized `TMP_DIR` constant. This will finally consolidate all temporary file operations for the E2E tests within the project's root directory.

### 15. Investigate Tarball Checksum Mismatch

**Issue:** The E2E tests are failing with a checksum mismatch between the source `dist` directory and the `dist` directory that is unpacked from the tarball during installation.

**Investigation:** The checksums being different indicates that the contents of the directory are being altered during the `npm pack` or `npm install` process. The most likely causes are files being excluded or line endings being changed (LF vs. CRLF). A single checksum for the entire directory does not provide enough information to identify the root cause.

**Fix:** To diagnose this, I will implement a more detailed verification process. Instead of comparing a single hash of the entire directory, the `verifyPackedContents` function will be updated to perform a file-by-file comparison. It will generate a list of all files and their individual MD5 checksums from both the source and installed `dist` directories. It will then log any discrepancies, including missing/extra files and any files with content mismatches. This will give us a precise report of what is causing the checksums to differ.

### 16. Investigate `RWSDK_SKIP_DEPLOY` Flag Ignored

**Issue:** The test harness is setting up a deployment environment even when the `RWSDK_SKIP_DEPLOY` environment variable is set.

**Investigation:** The user correctly pointed out that the check for the `SKIP_DEPLOYMENT_TESTS` flag is happening too late in the process. The `setupPlaygroundEnvironment` function, which is responsible for the expensive environment creation, does not check the flag and proceeds with the setup unconditionally.

**Fix:** I will investigate the `setupPlaygroundEnvironment` and `createDevServer` functions in the test harness to understand how the environments are being created and managed. The goal will be to refactor the logic to ensure that a single, shared playground environment is used for both the dev server and deployment tests for any given project. This will eliminate the redundant setup and significantly speed up the E2E test suite.

### 17. Respect `RWSDK_SKIP_DEPLOY` Flag During Setup

**Issue:** The test harness is setting up a deployment environment even when the `RWSDK_SKIP_DEPLOY` environment variable is set.

**Investigation:** The user correctly pointed out that the check for the `SKIP_DEPLOYMENT_TESTS` flag is happening too late in the process. The `setupPlaygroundEnvironment` function, which is responsible for the expensive environment creation, does not check the flag and proceeds with the setup unconditionally.

**Fix:** I will modify the `setupPlaygroundEnvironment` function to check for the `SKIP_DEPLOYMENT_TESTS` flag at the beginning of its execution. If the flag is set, the function will skip the entire deployment environment setup process. This will ensure the environment variable is respected and will prevent the unnecessary and time-consuming setup on the CI runner.

### 18. Dev Server Timing Out

**Issue:** With all other issues resolved, we are back to the original problem: the E2E tests are failing because they time out waiting for the dev server URL to become available.

**Investigation:** The dev server process is not producing any output in the CI logs, which makes it impossible to debug why it's hanging. This is a classic symptom of a child process being spawned with its `stdio` streams configured to `"pipe"` instead of `"inherit"`.

**Fix:** I will locate the code responsible for spawning the dev server process and change its `stdio` configuration to `"inherit"`. This will ensure that all output from the dev server (including startup progress and any errors) is streamed directly to the main test output. This increased visibility should allow us to diagnose the root cause of the timeout.

### 19. E2E Cache Path Mismatch

**Issue:** The E2E tests are experiencing a consistent cache miss on every run, forcing a full dependency installation each time.

**Investigation:** I reviewed the cache path generation logic in `sdk/src/lib/e2e/environment.mts` and discovered a discrepancy. The path used to check for an existing cache entry is different from the path used to save a new cache entry after installation. Specifically, the cache population logic includes an extra directory segment (`rwsdk-e2e-cache`) that is missing from the cache check logic.

**Fix:** I will correct the path construction in the cache check section to match the path used for cache population. This will align the read and write locations, ensuring that the cache is hit on subsequent test runs.

### 20. Create Standalone Debug Script for Dev Server

**Issue:** Even after redirecting the dev server's output, we are still not seeing any logs after the initial "Starting development server..." message. The process hangs without providing any diagnostic information.

**Investigation:** The complexity of the E2E test harness might be interfering with the child process or its output streams in a subtle way. To debug this effectively, we need to isolate the dev server launch from the test harness.

**Fix:** I will create a standalone Node.js script, `scripts/debug-dev-server.mjs`, that replicates the core logic for setting up a test environment and launching the dev server. This script will:
1.  Copy a specified playground project to a temporary directory.
2.  Pack the local SDK into a tarball.
3.  Install the packed SDK and other dependencies in the temporary project.
4.  Attempt to launch the dev server using the same command as the E2E tests, with `stdio` set to `"inherit"`.

This will provide a clean, isolated environment to reproduce and diagnose the hanging issue.

### 21. Exclude Intermediate Builds from Tarball Verification

**Issue:** The tarball verification step in the E2E tests is failing due to a checksum mismatch. The logs show that two extra files, `rwsdk-vendor-client-barrel.js` and `rwsdk-vendor-server-barrel.js`, are present in the `__intermediate_builds` directory of the installed package, but not in the source `dist` directory.

**Investigation:** These intermediate build artifacts are generated as part of the package installation process, which explains why they exist in the installed version but not in the local pre-packed version. The tarball verification logic needs to account for this.

**Fix:** I will modify the `verifyPackedContents` function to explicitly ignore the `__intermediate_builds` directory when comparing the file lists. This will prevent the verification from failing on these expected differences, allowing the tests to proceed.

### 22. Diagnose Dev Server Output Stream Handling

**Issue:** The dev server process is still not producing any visible output during E2E tests, even after an attempt to pipe its `stdout` and `stderr` streams to the main process.

**Investigation:** The user correctly pointed out that the `runDevServer` function already had `'.on('data', ...)` listeners attached to the process's output streams to parse the server URL. Adding a `.pipe()` call can interfere with these existing listeners, as a stream can only be consumed once. This is the likely reason the output is still being suppressed.

**Fix:** I will remove the `.pipe()` calls. Instead, I will add a `console.log` statement directly inside the existing `handleOutput` function. This will print all raw output received from the dev server directly to the console, providing the necessary visibility for debugging without disrupting the URL parsing logic.

### 23. Conditional Logging for Dependency Installation

**Issue:** The dependency installation step can be very verbose. While this output is useful for debugging, it adds a lot of noise to the CI logs during normal test runs.

**Investigation:** The `installDependencies` function currently uses a hardcoded `stdio: "inherit"` setting, which always streams the full output. We need a way to make this conditional.

**Fix:** I will modify the `installDependencies` function to check if the `rwsdk:e2e:environment` debug channel is enabled.
- If it is enabled, `stdio` will be set to `"inherit"` to provide detailed logs for debugging.
- If it is disabled, `stdio` will be set to `"pipe"` to suppress the output and keep the main logs clean.
In case of an installation failure, the existing error handling will log the captured output from the piped process, ensuring that we still have access to the relevant information when things go wrong.

### 24. Stream Installation Logs Through Debug Logger

**Issue:** The conditional `stdio: "inherit"` is too blunt for debugging dependency installation. It streams raw output without the context of which logger is producing it.

**Investigation:** The user requested that we always pipe the installer's output. Then, only if the `rwsdk:e2e:environment` debug channel is enabled, should we stream that output through the `debug` logger. This ensures the output is always captured for error reporting, but only displayed in real-time with the proper logger prefix during debugging sessions.

**Fix:** I will modify the `installDependencies` function to always use `stdio: "pipe"`. I will then add logic that checks if the logger is enabled. If it is, I will attach `.on('data')` listeners to the `stdout` and `stderr` streams of the child process. These listeners will forward the output to the `log` function, which will prefix it correctly.

### 25. Optimize E2E Cache for Developer Workflow

**Issue:** The current E2E caching strategy invalidates the cache on every change to the SDK's `dist` directory. While correct, this is inefficient for local development, as it forces a slow, full dependency re-installation for every code change.

**Investigation:** The user pointed out that this behavior defeats the purpose of the cache for rapid iteration. The cache should only be invalidated when third-party dependencies change, not when the local SDK source code is modified.

**Fix:** I will implement a more sophisticated caching strategy:
1.  **Dependency-Based Cache Key:** The cache key will be generated from a hash of the test project's `package.json` and lockfile (`pnpm-lock.yaml`, `package-lock.json`, etc.). The SDK's `dist` directory will no longer be part of this key.
2.  **Two-Stage Installation on Cache Hit:** When a cache hit occurs, the test harness will:
    a. Restore the cached `node_modules` directory.
    b. Run a fast, targeted installation of just the locally packed SDK tarball. This updates the local SDK without re-installing all other dependencies.
3.  **Full Installation on Cache Miss:** If a cache miss occurs (due to a change in dependencies), the harness will perform a full, clean installation and then populate the cache with the resulting `node_modules` directory for future runs.