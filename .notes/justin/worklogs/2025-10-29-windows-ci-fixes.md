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