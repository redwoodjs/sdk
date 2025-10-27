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

---

## PR Description

### fix(windows): Resolve Windows-specific path handling issues

This change addresses a series of critical path-related bugs that prevented the development server from running on Windows. The fixes ensure that file paths are resolved, formatted, and checked in a cross-platform-compatible manner.

This resolves #696.

### Key Issues and Fixes

1.  **Incorrect Path Resolution Leading to `ENOENT` Errors**
    - **Problem:** The dev server failed with an `ENOENT` error, showing an invalid path with a duplicated drive letter (e.g., `D:\D:\...`).
    - **Cause:** `__dirname` was calculated using `new URL(".", import.meta.url).pathname`, which produces a POSIX-style path on Windows (e.g., `/D:/path`). When passed to `path.resolve()`, this resulted in an incorrect path.
    - **Solution:** Switched to the standard `fileURLToPath(import.meta.url)` and `dirname` combination to ensure correct, cross-platform path resolution.

2.  **`ERR_UNSUPPORTED_ESM_URL_SCHEME` on Startup**
    - **Problem:** Node.js threw an `ERR_UNSUPPORTED_ESM_URL_SCHEME` error because a dynamic `import()` was called with a raw Windows path.
    - **Cause:** The `getViteEsbuild` helper function attempted to `import()` Vite's internal esbuild module using a path like `D:\path\to\file.js`. Node's ESM loader requires absolute paths on Windows to be valid `file://` URLs.
    - **Solution:** The path is now converted to a `file://` URL using `pathToFileURL()` before being passed to `import()`, satisfying the ESM loader's requirement.

3.  **Directive Scan Failing Silently on Windows**
    - **Problem:** A runtime error, `No module found for "use client" directive`, occurred because the initial directive scan was not detecting any client or server components.
    - **Cause:** The esbuild plugin used for the scan contained a filter (`!args.path.startsWith("/")`) to identify absolute paths. This check is incorrect for Windows paths, causing every file to be skipped during the scan.
    - **Solution:** Replaced the string-based check with `path.isAbsolute()`, which provides a reliable, cross-platform method for identifying absolute paths.

4.  **Enabling Windows CI**
    - To validate these fixes and prevent future regressions, `windows-latest` has been added to the test matrix for the smoke test and end-to-end test workflows. This will ensure that our test suites are run on a Windows environment.

5.  **Cross-Platform Asset Handling in Build Process**
    - **Problem**: The build process failed on Windows with an `mv: cannot stat` error.
    - **Cause**: The build used the Unix `mv` command with a glob pattern to move CSS assets. This is not compatible with Windows and can be unreliable in different shell environments.
    - **Solution**: Replaced the shell command with Node.js APIs (`glob` and `fs-extra`) to find and move files, ensuring the asset handling is cross-platform.