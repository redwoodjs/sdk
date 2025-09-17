# Work Log: 2025-09-16 - Investigating SSR Failure in Alpha 4

## 1. Problem Definition

After the release of `1.0.0-alpha.4`, a blocking issue was discovered in the development server. For certain pages, the server-side rendering process would fail with a `TypeError: Cannot read properties of undefined (reading 'Root')`. This error did not occur in `alpha.3`, indicating a regression.

The goal is to perform a detailed analysis of the changes between `alpha.3` and `alpha.4`, isolate the root cause of the SSR failure, and implement a fix.

## 2. Investigation & Findings

### Initial Triage: Isolating the Commit

The first step was to review the git history between `v1.0.0-alpha.3` and `v1.0.0-alpha.4`. Most changes were related to documentation or build-specific fixes. However, one commit, `f7457ff3` ("tests: Add more unit tests"), stood out as it contained numerous refactorings to runtime and Vite plugin code alongside the new tests.

A local revert of this commit was performed, and the SSR error immediately disappeared. This provided definitive confirmation that the regression was introduced somewhere within the changes of `f7457ff3`.

### Analysis of Code Changes

The next step was a careful review of all non-test code modifications in the commit. The changes were categorized into two groups: pure refactoring and actual logic changes.

-   **Logic Changes:** Files like `getShortName.mts`, `hasPkgScript.mts`, and `jsonUtils.mts` had their behavior altered. Initial suspicion fell here, but further investigation showed these were not the cause. A `grep` confirmed `getShortName` was only used for HMR logging, and the other changes were in code paths not exercised during a typical SSR page render in development.

-   **Refactoring:** Files like `runDirectivesScan.mts` and `miniflareHMRPlugin.mts` were refactored for testability but their logic appeared unchanged. While these plugins are critical to the dev server, the fact that the directive scan completed successfully made them less likely suspects for a runtime rendering error.

### Root Cause Discovery

After the initial analysis proved inconclusive, a more detailed, line-by-line review of the entire diff was conducted. The error was finally located in a seemingly minor change within `sdk/src/vite/directiveModulesDevPlugin.mts`.

An unsolicited `.slice(1)` method call had been added during the refactoring:

```diff
--- a/sdk/src/vite/directiveModulesDevPlugin.mts
+++ b/sdk/src/vite/directiveModulesDevPlugin.mts
@@ -30,8 +30,7 @@
     [...files]
       .filter((file) => file.includes("node_modules"))
       .map(
-        (file, i) =>
-          `  '${normalizeModulePath(file, projectRootDir).slice(1)}': M${i},`,
+        (file, i) => `  '${normalizeModulePath(file, projectRootDir)}': M${i},`,
       )
       .join("\n") +
```

The function of this code is to generate a virtual "barrel file" for vendor (`node_modules`) packages that contain `"use client"` or `"use server"` directives. The `.slice(1)` call was incorrectly stripping the leading slash from the normalized module paths, creating invalid identifiers (e.g., `node_modules/lib/index.js` instead of the correct `/node_modules/lib/index.js`).

This explained why the error only occurred on specific pages. The application would run correctly until a page that depended on one of these mis-pathed vendor modules was requested. At that point, the SSR runtime was unable to resolve the incorrect path from the barrel file, leading to the `TypeError` when it failed to load the component.

## 3. Resolution

The fix was straightforward: the erroneous `.slice(1)` method call was removed from `directiveModulesDevPlugin.mts`.

The corresponding unit test in `directiveModulesDevPlugin.test.mts`, which had been incorrectly asserting the sliced path, was updated to expect the correct, valid path format with the leading slash. This resolves the immediate issue and ensures future test runs will catch any similar regressions.
