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

### 3. Unsupported ESM URL Scheme

**Issue:** After fixing the path resolution and rebuilding, a new error occurs when the framework scans for directives: `Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: ... Received protocol 'd:'`.

**Investigation:** This error is coming from `runDirectivesScan.mjs` and indicates that an `import()` call is being made with a raw Windows path (e.g., `D:\path\to\file`) instead of a valid `file://` URL. The ESM loader in Node.js is strict about this. I need to find where the import path is being constructed and ensure it's converted to a proper URL before being used.
