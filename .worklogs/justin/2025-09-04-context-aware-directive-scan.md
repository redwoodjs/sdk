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
