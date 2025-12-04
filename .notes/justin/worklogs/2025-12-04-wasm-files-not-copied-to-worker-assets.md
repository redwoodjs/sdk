
# Work Log: WASM files not copied to worker assets directory

**Date:** 2025-12-04

## Problem

After a recent upgrade to `rwsdk` (beta.31+), projects using WASM modules are failing in production. The build process correctly places WASM files in `dist/client/assets/`, but neglects to copy them to `dist/worker/assets/`. This causes a runtime error when the worker attempts to import a non-existent WASM module.

The user has pointed out that this seems to be a regression, possibly introduced in commit `8bf62d98` which changed how the SSR bundle is wrapped, or in PR #903 which altered how static assets are handled by moving all non-js/map files from the worker build to the client build.

## Plan

1.  **Reproduce the issue:** Create a new playground example that uses a WASM-dependent library (`yoga-wasm-web` seems like a good candidate).
2.  **Write a failing test:** Add an end-to-end test to the new playground example that verifies the WASM module is loaded and functional. This test is expected to fail with the current build process.
3.  **Stop for confirmation:** Once the failing test is in place, I will stop and await feedback before proceeding with a fix.
4.  **Investigate and fix:** The likely culprit is the `moveStaticAssetsPlugin`. The fix will likely involve adjusting the plugin to exclude WASM files from being moved from `dist/worker/assets` to `dist/client/assets`.
5.  **Verify the fix:** Rerun the E2E test to ensure it passes.

## Context

- **Offending Commit (Hypothesis 1):** `8bf62d98` - Changed SSR bundle wrapping, which might have affected how WASM imports are handled.
- **Offending PR (Hypothesis 2):** #903 - Broadened `moveStaticAssetsPlugin` to move all static assets from worker to client build output, which could be inadvertently moving WASM files that are needed by the worker.

My current hypothesis is that the changes in #903 are the more likely cause, as it directly deals with asset relocation between worker and client distributables. The plan is to confirm this by creating a reproduction case.
