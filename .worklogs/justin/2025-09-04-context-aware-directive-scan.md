# 2025-09-04: Context-Aware Directive Scanning

## Problem

The directive scanner in `runDirectivesScan.mts` uses two static `enhanced-resolve` instances—one for the `client` environment and one for the `worker` (server) environment. This resolution is not context-aware. It doesn't adapt based on whether the file being processed is downstream of a `"use client"` or `"use server"` directive. This can lead to incorrect module resolution, especially for packages that use conditional exports (like `"react-server"`) to provide different implementations for different environments. The scanner needs to dynamically switch its resolution strategy to match the environment of the current file in the dependency graph.

## Plan

The implementation will be a surgical change confined to the `esbuild` plugin within `runDirectivesScan.mts`.

1.  **Introduce Stateful Tracking**: A `Map` called `moduleEnvironments` will be created to store the effective environment (`'client'` or `'worker'`) for each module path encountered during the scan.

2.  **Modify `onResolve` Hook**:
    *   When resolving an import, the hook will look up the importer's environment in the `moduleEnvironments` map. The default for entry points will be `'worker'`.
    *   Based on the importer's environment, it will dynamically select either the `clientResolver` or the `workerResolver` for the current resolution task.
    *   The importer's environment will be passed down to the `onLoad` hook using `esbuild`'s `pluginData` mechanism to ensure context is propagated.

3.  **Modify `onLoad` Hook**:
    *   This hook will receive the inherited environment from `onResolve`.
    *   It will read the file's content to check for `"use client"` or `"use server"` directives.
    *   A directive within the file itself will take precedence, overriding the inherited environment. If no directive is present, the inherited environment is used.
    *   The module's definitive environment will then be stored in the `moduleEnvironments` map for use in subsequent resolutions.

This approach will create a stateful, context-aware traversal of the dependency graph, ensuring that module resolution correctly adapts when crossing directive boundaries. The existing `clientFiles` and `serverFiles` sets will continue to function as the final output of the scan.

## Investigation

After implementing the changes, testing revealed that the context-aware resolution isn't working as expected. The error shows that `@ai-sdk/react` is being resolved with `react-server` conditions when it should use client conditions.

The test project has a `worker.tsx` entry point that imports `ChatAgent.tsx`, which contains a `"use client"` directive. However, the debug output shows no client directives are being discovered during the scan. This suggests the issue might be in the directive detection logic or the file isn't being processed by the `onLoad` hook.

## Solution

The root cause was a timing issue combined with incorrect resolver configuration:

1. **Timing Issue**: The original implementation detected directives in `onLoad` after imports had already been resolved in `onResolve`. This meant that when `ChatAgent.tsx` (with `"use client"`) imported `@ai-sdk/react`, the imports were resolved using worker conditions before the directive was discovered.

2. **Resolver Configuration**: The client resolver was incorrectly trying to use a non-existent `"client"` environment, when it should have used browser conditions (`["browser", "module"]`) instead of the worker's react-server conditions.

The fix involved:
- Moving directive detection to the `onResolve` phase by reading file contents early
- Creating a proper client resolver with browser conditions using `mapViteResolveToEnhancedResolveOptions` and overriding `conditionNames`
- Ensuring that when a file with `"use client"` imports other modules, those imports are resolved with the correct client environment

The solution successfully resolves the SWR react-server export error and allows the dev server to start correctly.

## Refactor and Cleanup

After the main fix was implemented, a cleanup pass was performed to address inefficiencies introduced during the debugging process.

### Problem

The directive scanner in `runDirectivesScan.mts` now worked correctly, but it had some redundancies:
- The `onLoad` hook contained logic that was now unnecessary because the module's environment was determined earlier in the `onResolve` hook.
- Files were potentially read from disk multiple times—once in `onResolve` to check for directives, and again in `onLoad` to provide the content to `esbuild`.
- The logic in `onLoad` for checking directives was more complex than it needed to be.

### Plan

The refactoring streamlined the `esbuild` plugin for clarity and efficiency:

1.  **File Cache**: A `Map` called `fileContentCache` was added to store the contents of files that have been read from disk, preventing redundant file I/O.
2.  **Caching Helper**: A helper function, `readFileWithCache`, was created to manage reading from the cache or disk as needed.
3.  **Refactor `onResolve`**: The `onResolve` hook was updated to use the `readFileWithCache` helper.
4.  **Simplify `onLoad`**: The `onLoad` hook was simplified to only provide file content to `esbuild` and populate the final output sets (`clientFiles` and `serverFiles`), using the caching helper to avoid extra disk reads.
