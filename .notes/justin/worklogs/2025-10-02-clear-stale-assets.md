# 2025-10-02: Clear Stale Assets and Investigate Virtual Manifests

## Problem

- The production build process leaves stale assets in `dist/worker/assets` across builds. This is evident in `playground/hello-world` and likely affects all projects.
- The build also generates several `_virtual_rwsdk_manifest-*.js` files in the worker assets directory. It's unclear if these are necessary, as the final worker output is expected to be a single, self-contained bundle.
- Both issues appear to be side effects of the multi-stage build process, where build directory clearing (`emptyOutDir`) is carefully managed to preserve intermediate artifacts between stages. Simply enabling `emptyOutDir` for the worker is not a solution, as later build stages depend on the output of earlier ones.

## Plan

1.  **Address Stale Assets**: Instead of using `emptyOutDir`, a more targeted approach is needed. The plan is to programmatically delete the `dist/client` and `dist/worker/assets` directories at the beginning of the `buildApp` function. This should clear out old assets without interfering with the intermediate `dist/worker/index.js` file required by the linker pass.

2.  **Investigate Virtual Manifests**: Once the asset issue is resolved, I'll look into why the virtual manifest files are generated. This involves:
    -   Identifying which plugin or part of the build process creates these `_virtual_rwsdk_manifest` modules.
    -   Analyzing whether they are essential for the final worker bundle or if they are artifacts that can be eliminated, possibly by adjusting Rollup's output options to prevent chunking for the worker build.
