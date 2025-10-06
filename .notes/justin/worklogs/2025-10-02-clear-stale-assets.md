# 2025-10-02: Clear Stale Assets and Investigate Virtual Manifests

## Problem

- The production build process leaves stale assets in `dist/worker/assets` across builds. This is evident in `playground/hello-world` and likely affects all projects.
- The build also generates several `_virtual_rwsdk_manifest-*.js` files in the worker assets directory. It's unclear if these are necessary, as the final worker output is expected to be a single, self-contained bundle.
- Both issues appear to be side effects of the multi-stage build process, where build directory clearing (`emptyOutDir`) is carefully managed to preserve intermediate artifacts between stages.

## Plan

### Attempt 1: Targeted Deletion & Virtual Module `external`

The initial plan was to programmatically delete stale asset directories and then treat the virtual manifest module as `external` during the initial build passes. While this prevented the asset from being created in the first pass, the linker pass would still see the dynamic `import()` and create the asset, only solving half the problem.

### Attempt 2: Direct Placeholder Replacement

A more direct solution is to avoid the dynamic import and virtual module entirely.

1.  **Modify `sdk/src/runtime/lib/manifest.ts`**: Use the `import.meta.env.VITE_IS_DEV_SERVER` environment variable to conditionally export a simple string placeholder (`"__RWSDK_MANIFEST_PLACEHOLDER__"`) in production, and an empty object (`{}`) in development.
2.  **Update `sdk/src/vite/linkerPlugin.mts`**: Modify the plugin to search for and replace the placeholder string with the actual manifest content.
3.  **Delete `sdk/src/vite/manifestPlugin.mts`**: This plugin is no longer necessary.
4.  **Update `sdk/src/vite/redwoodPlugin.mts`**: Remove the `manifestPlugin` from the plugin array.

This approach is simpler, more direct, and avoids any complex interactions with Rollup's code-splitting logic.

### Attempt 3: Clearing Stale Assets

With the virtual manifest asset issue resolved, the final step is to ensure a clean build directory. I've added a command to the beginning of the `buildApp` function in `sdk/src/vite/buildApp.mts` to recursively delete the entire `dist` directory before any build steps run. This guarantees that no stale assets from previous builds are carried over.

---

## PR Description

### build: Clear stale assets and prevent manifest chunking

This change addresses two related issues that arose from the multi-stage production build process: the accumulation of stale assets between builds and the generation of unnecessary virtual manifest chunks.

#### Problem

1.  **Stale Assets**: Successive builds would leave old assets (like CSS files and hashed JS chunks) in the `dist` directory. This was because the build orchestrator avoided clearing the output directory to preserve intermediate artifacts, like the worker bundle needed for the linker pass.

2.  **Unnecessary Manifest Chunk**: The build process generated a `_virtual_rwsdk_manifest-*.js` file in the worker's assets. This was caused by the runtime using a dynamic `import()` to load the manifest. Rollup's default behavior is to code-split dynamic imports, which created this separate, unnecessary file.

#### Solution

The solution involved two main changes:

1.  **Direct Manifest Injection**: The virtual manifest module and dynamic import have been replaced with a more direct approach.
    -   The runtime (`sdk/src/runtime/lib/manifest.ts`) now uses a simple string placeholder (`"__RWSDK_MANIFEST_PLACEHOLDER__"`) during production builds.
    -   The `linkerPlugin` now performs a direct string replacement, injecting the `manifest.json` content directly into the final worker bundle.
    -   This avoids fighting Rollup's code-splitting logic and, as a result, the `manifestPlugin` was no longer needed and has been removed.

2.  **Pre-Build Directory Cleaning**: To solve the stale asset problem, a command has been added to the beginning of the `buildApp` function that recursively deletes the entire `dist` directory. This ensures every production build starts from a clean slate without interfering with the multi-stage process that follows.
