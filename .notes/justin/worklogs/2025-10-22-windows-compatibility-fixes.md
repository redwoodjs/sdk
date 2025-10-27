# 2025-10-22: Windows Compatibility Fixes

## Problem

When attempting to run the `starter` project on a Windows machine, the development server fails to start. This is the first step in a larger effort to ensure the framework is fully compatible with Windows for development.

## Initial Findings & Fixes

### 1. Missing Build Step

**Issue:** The first error encountered was `ERR_MODULE_NOT_FOUND`, indicating that Vite could not find the `rwsdk` module.

**Investigation:** I discovered that the `rwsdk` package, which is a local dependency in the monorepo, had not been built. The necessary files in the `sdk/dist` directory were missing. The build scripts in `package.json` also had some compatibility issues with PowerShell.

**Fix:** The solution was to run the build script for the SDK from the project root (`pnpm build:sdk`) and then start the development server from the `starter` directory.

### 2. Incorrect Path Resolution in ES Modules

**Issue:** After building the SDK, a new error appeared related to incorrect file paths. Logs showed paths being resolved to `D:\D:\...`, which is invalid. This was traced back to `sdk/src/lib/constants.mts`.

**Investigation:** The `__dirname` constant was being calculated using `new URL(".", import.meta.url).pathname`. On Windows, this method produces a POSIX-style path with a leading slash (e.g., `/D:/path/to/file`), which confuses the Node.js `path.resolve()` function, causing it to incorrectly prepend the current drive letter.

**Fix:** I updated `sdk/src/lib/constants.mts` to use the standard, cross-platform method for resolving `__dirname` in ES modules using `fileURLToPath` and `dirname`. This ensures that paths are resolved correctly on all operating systems.

```
error when starting dev server:
Error: ENOENT: no such file or directory, mkdir 'D:\D:\a\sdk\sdk\sdk\dist\__intermediate_builds'
    at mkdirSync (node:fs:1363:26)
    at BasicMinimalPluginContext.configResolved (file:///D:/a/sdk/sdk/sdk/dist/vite/directiveModulesDevPlugin.mjs:78:13)
    at file:///D:/a/sdk/sdk/node_modules/.pnpm/vite@7.1.11_@types+node@24._b175a3388020c0d57db16267658e7308/node_modules/vite/dist/node/chunks/config.js:35906:87
    at Array.map (<anonymous>)
    at resolveConfig (file:///D:/a/sdk/sdk/node_modules/.pnpm/vite@7.1.11_@types+node@24._b175a3388020c0d57db16267658e7308/node_modules/vite/dist/node/chunks/config.js:35906:68)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async _createServer (file:///D:/a/sdk/sdk/node_modules/.pnpm/vite@7.1.11_@types+node@24._b175a3388020c0d57db16267658e7308/node_modules/vite/dist/node/chunks/config.js:27952:67)
    at async CAC.<anonymous> (file:///D:/a/sdk/sdk/node_modules/.pnpm/vite@7.1.11_@types+node@24._b175a3388020c0d57db16267658e7308/node_modules/vite/dist/node/cli.js:572:18)
 ELIFECYCLE  Command failed with exit code 1.
```

### 3. Unsupported ESM URL Scheme

**Issue:** After fixing the path resolution and rebuilding, a new error occurs when the framework scans for directives: `Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: ... Received protocol 'd:'`.

**Investigation:** This error is coming from `runDirectivesScan.mjs` and indicates that an `import()` call is being made with a raw Windows path (e.g., `D:\path\to\file`) instead of a valid `file://` URL. The ESM loader in Node.js is strict about this. I need to find where the import path is being constructed and ensure it's converted to a proper URL before being used.


This should provide a detailed trace of the operations leading up to the crash, which will hopefully reveal the exact module that is being imported incorrectly.

```
Error: RWSDK directive scan failed:
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data, and node are supported by the default ESM loader. On Windows, absolute paths must be valid file:// URLs. Received protocol 'd:'
    at throwIfUnsupportedURLScheme (node:internal/modules/esm/load:187:11)
    at defaultLoad (node:internal/modules/esm/load:82:3)
    at ModuleLoader.load (node:internal/modules/esm/loader:815:12)
    at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:594:31)
    at #createModuleJob (node:internal/modules/esm/loader:624:36)
    at #getJobFromResolveResult (node:internal/modules/esm/loader:343:34)
    at ModuleLoader.getModuleJobForImport (node:internal/modules/esm/loader:311:41)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
    at async onImport.tracePromise.__proto__ (node:internal/modules/esm/loader:664:25)
    at runDirectivesScan (file:///D:/a/sdk/sdk/sdk/dist/vite/runDirectivesScan.mjs:294:15)
    at process.processTicksAndRejections (node:internal/process/task_queues:105:5)
  ```

To narrow down the source of the invalid path, I'm now attempting to capture more verbose output by enabling all debug logs and redirecting the output to a file. I will run the following command from the project root:

```powershell
cd ..; pnpm build:sdk; cd starter; $env:DEBUG="*"; pnpm dev 2>&1 | Tee-Object -FilePath "out.log"
```

### 4. `normalizeModulePath` Is Not Called

**Issue:** After adding verbose logging to the `normalizeModulePath` function and re-running, I discovered that none of the new logs appeared in the output before the application crashed.

**Investigation:** This is a critical finding. It proves that the error occurs *before* our custom module resolution logic has a chance to run. The problem is not with how we resolve `import` statements within files, but rather with how esbuild handles the initial list of files it's asked to scan. The evidence now points directly at the `entryPoints` array that is passed to `esbuild.build`. Esbuild is likely attempting to load one of these entry points using a raw Windows path, which is then rejected by Node's ESM loader.

**Fix:** The next step is to apply a targeted fix: convert all paths in the `entryPoints` array into valid `file://` URLs before passing them to esbuild. This should resolve the `ERR_UNSUPPORTED_ESM_URL_SCHEME` error.

### 5. Pinpointing the Crash in `getViteEsbuild`

**Issue:** After a previous fix failed, I noticed that a key debug log ("Starting directives scan...") was not appearing in the output.

**Investigation:** This was a critical observation. The absence of that log proved the crash was happening much earlier in the `runDirectivesScan` function than previously assumed. By examining the code that runs before the missing log statement, I identified the culprit: the `getViteEsbuild` helper function.

This function dynamically constructs a path to Vite's internal copy of esbuild and then loads it using a dynamic `import()`. On Windows, this results in an `import('D:\\path\\to\\esbuild.js')` call, which is the direct cause of the `ERR_UNSUPPORTED_ESM_URL_SCHEME` error. All previous debugging confirmed this was the issue, but we were looking in the wrong place.

**Fix:** The fix is to modify `getViteEsbuild` to convert the constructed path into a `file://` URL before passing it to `import()`. This will be the definitive solution for this specific crash.

### 6. "use client" Module Lookup Failure

**Issue:** After all previous build-time errors were resolved, the development server now starts successfully. However, when trying to render a page, the server throws a new runtime error: `Internal server error: (ssr) No module found for '/src/app/pages/Welcome.tsx' in module lookup for "use client" directive`.

**Investigation:** This error indicates that the framework's module lookup system, which relies on the results of the initial directive scan, is failing. The path format in the error (`/src/app/pages/Welcome.tsx`) is a normalized, Vite-style path. The failure suggests there is a discrepancy between how this path was generated and stored during the scan and how it is being generated and looked up during the server-side render. This is likely another Windows-specific path normalization inconsistency.

**Plan:** To debug this, the immediate next step is to inspect the contents of the `clientFiles` and `serverFiles` sets right after the directive scan completes. The user will add logging to see exactly what paths are stored in these sets. By comparing the stored paths with the path that is failing the lookup, we can identify the source of the normalization mismatch and correct it.

**Update:** The debugging plan yielded a surprising and critical result. The log output for `clientFiles` and `serverFiles` after the scan is complete shows that both sets are empty: `client=[], server=[]`.

This is a significant finding. It means the problem is not a runtime path mismatch, as previously suspected. Instead, the directive scan itself is failing to detect any files containing 'use client' or 'use server' directives on Windows. The scan is completing silently without populating the module sets, which is the root cause of the downstream "No module found" error. The investigation must now shift to why the scanning and file content analysis process is not working as expected in the Windows environment.

### 7. Cross-Platform Path Checking in Esbuild `onLoad`

**Issue:** After discovering that the directive scan was producing empty `clientFiles` and `serverFiles` sets on Windows, a detailed review of `runDirectivesScan.mts` revealed the root cause. The `onLoad` plugin for esbuild was using an incorrect method to check for absolute paths.

**Investigation:** The `onLoad` filter contained the condition `!args.path.startsWith("/")` to identify and skip non-absolute paths. While this works on POSIX-based systems, it fails on Windows, where absolute paths begin with a drive letter (e.g., `D:\...`). Verbose logging confirmed this hypothesis, showing the log message `Skipping file due to filter: ... { startsWithSlash: false, ... }` for every file processed on Windows. This faulty check caused esbuild to skip every file during the scan, leading to the empty module sets.

**Fix:** The solution is to replace the string comparison with Node.js's built-in, cross-platform `path.isAbsolute()` function. This ensures that paths are correctly identified as absolute on all operating systems, allowing the esbuild scan to proceed as intended.

### 8. Cross-Platform E2E Test Script

**Problem**: The `test:e2E` script failed to run on Windows because it was a bash script (`.sh`).

**Cause**: Windows cannot execute shell scripts natively.

**Solution**: Replaced the bash script with a cross-platform Node.js script that replicates the same logic, allowing the E2E tests to be run on any operating system.

### 9. Cross-Platform Path Handling in E2E Test Harness

**Problem**: The E2E tests failed on Windows with an error indicating it could not find a `package.json`.

**Cause**: The test harness used `new URL().pathname` and a POSIX-specific root check (`currentDir !== "/'`) to locate the test playground directory. Both of these are incorrect on Windows.

**Solution**: Switched to `fileURLToPath()` for correct URL-to-path conversion and a more robust loop condition (`dirname(currentDir) !== currentDir`) to make the directory search cross-platform.

### 10. URL Encoding for `worker-run` Script Paths

**Problem**: The `worker-run` script, used for database seeding in tests, failed on Windows.

**Cause**: The script passed a raw Windows file path directly into a URL query parameter without encoding it. Backslashes and other special characters in the path corrupted the URL.

**Solution**: The file path is now wrapped in `encodeURIComponent` before being added to the URL, ensuring it is correctly formatted and parsed by the dev server.

### 11. Cross-Platform Process Killing in E2E Tests

**Problem**: After fixing the previous pathing issues, E2E tests on Windows still failed. The dev server would not start, causing the tests to time out, and a subsequent `EBUSY: resource busy or locked` error would occur during the cleanup phase.

**Investigation**: The `EBUSY` error indicated that the test cleanup process was unable to delete the temporary playground directory because a process still held a file lock. The polling timeout confirmed that the dev server was the hanging process. The root cause was the `stopDev` function in the test harness, which used POSIX-specific signals (`SIGTERM`, `SIGKILL`) and process group IDs (`-pid`) to terminate the server. This method is not supported on Windows, causing the server process to be orphaned and to maintain a lock on the test directory, preventing cleanup.

**Solution**: The initial plan was to write custom, cross-platform process termination logic using `taskkill` on Windows and `process.kill` on other systems. However, a better approach is to use a dedicated library for this. The `tree-kill` package is a small, focused utility that provides a reliable, cross-platform way to kill a process and its entire descendant tree.

To minimize the production dependency footprint and reduce any potential attack surface from third-party code, `tree-kill` has been added as a `devDependency`. While the E2E test harness is technically an exported module of the SDK, this is a deliberate trade-off that prioritizes the security and leanness of the production `rwsdk` package, as `tree-kill` is only ever used in a testing context. The `stopDev` function was refactored to use this library, creating a more robust and maintainable solution.

### 12. Cross-Platform Command Execution in E2E Tests

**Problem**: Even after fixing the process cleanup logic, the E2E tests on Windows still timed out, with the root cause being a silent failure of the dev server to start. Diagnostic tests showed that the child process was not producing any output on `stdout` or `stderr`.

**Investigation**: The issue was traced to the `execa` library's tagged-template syntax (`$``...`). A test using a simple `echo` command revealed that this syntax was not parsing commands with arguments correctly on Windows, leading to an immediate, silent exit. The command was being misinterpreted, causing `execa` to fail before any output could be generated.

**Solution**: The fix is to use `execa`'s more robust, array-based syntax (`$(command, [arg1, arg2])`). This method avoids shell parsing ambiguities and is the recommended approach for cross-platform compatibility. The command to start the dev server was refactored to use this syntax, which allows the process to be spawned correctly and its output to be captured by the test harness. This resolves the final blocker for the E2E tests on Windows.

### 13. Codebase Audit for Cross-Platform Compatibility

**Problem**: The repeated discovery of Windows-specific bugs, particularly related to process spawning and file system commands, indicated that these issues were likely not isolated. A systematic audit was needed to proactively identify and fix other potential cross-platform compatibility problems.

**Investigation & Solution**: I conducted a full-codebase audit with three main goals:

1.  **Audit Process Killing**: A search for `process.kill` confirmed that no POSIX-specific process termination logic exists in the production codebase. This validated the decision to keep the `tree-kill` library as a `devDependency`, as it is only needed for the E2E test suite.

2.  **Audit Process Spawning and Unix Commands**: I searched for all usages of the `execa` tagged-template syntax (`$``...`) and other Unix-specific shell commands. The following files were refactored to use the explicit, array-based `execa` syntax and cross-platform Node.js APIs:
    *   `sdk/src/vite/redwoodPlugin.mts`
    *   `sdk/src/scripts/migrate-new.mts`
    *   `sdk/src/scripts/ensure-deploy-env.mts`
    *   `sdk/src/scripts/dev-init.mts`
    *   `sdk/src/scripts/debug-sync.mts`
    *   `sdk/src/lib/smokeTests/browser.mts` (replaced `curl` with `fetch`)
    *   `sdk/src/lib/e2e/tarball.mts` (replaced `cp` with `fs.cp`)

3.  **Implement Type-Safe `execa` Wrapper**: To prevent the unsafe tagged-template syntax from being used in the future, the `$` utility in `sdk/src/lib/$.mts` was replaced with a type-safe wrapper. After an initial complex attempt that resulted in TypeScript errors, a much simpler and more robust solution was implemented. The final wrapper is a plain function that calls `execa` internally, which naturally disallows the template-literal form at the type level and forces the use of the safer array-based syntax (`$(command, [args])`). This provides a strong, compile-time guarantee against future cross-platform command parsing bugs.