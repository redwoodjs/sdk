# 2025-09-11: Investigating and Fixing Windows Path Failures

## Problem Definition

The RedwoodSDK codebase exhibited two distinct path-related failures when running on the Windows operating system. The first issue was a path duplication error, where directory creation failed because paths were being constructed with a repeated drive letter (e.g., `C:\C:\...`). This was traced to an incorrect method of deriving `__dirname` in an ES module context. The second issue was a Node.js ESM loader error (`ERR_UNSUPPORTED_ESM_URL_SCHEME`), which occurs when absolute Windows paths are not formatted as valid `file://` URLs.

## Investigation Narrative

The investigation began by enabling the Windows smoke tests, which were previously skipped in the GitHub Actions workflow. This provided a reliable environment to reproduce and diagnose the failures.

The initial test run immediately failed with the path duplication error. The error message pointed to the `directiveModulesDevPlugin.mjs` file, where a `mkdirSync` operation was failing. I traced the source of the invalid path back to `sdk/src/lib/constants.mts`. The root cause was the use of `new URL(".", import.meta.url).pathname` to determine the current directory. On Windows, this results in a path with a leading slash (e.g., `/C:/...`), which, when combined with `path.resolve`, produced the duplicated drive letter. The solution was to replace this with `fileURLToPath(new URL(".", import.meta.url))`, which correctly converts the module URL to a system-appropriate file path.

After applying this fix, the path duplication error was resolved. However, a subsequent test run revealed the second issue: the ESM URL scheme error. The test logs showed that the directive scan process was now failing because the Node.js ESM loader received a standard Windows absolute path (e.g., `C:\...`) instead of the required `file:///C:/...` URL format.

An initial attempt was made to convert paths to `file://` URLs within the esbuild plugin's `onResolve` handler and then convert them back for file system operations. This approach did not resolve the issue, suggesting the problem might originate from the entry points supplied to esbuild rather than from the module resolution process within it. The investigation into the precise cause of the ESM scheme error is ongoing.

## Current Status

The path duplication error has been successfully identified and fixed. The codebase now correctly constructs absolute paths on Windows. The primary remaining blocker is the ESM URL scheme error, which prevents the smoke tests from passing. Further work is required to ensure all paths passed to the Node.js ESM loader are correctly formatted as `file://` URLs.
