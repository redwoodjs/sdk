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