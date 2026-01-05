# WASM Files Not Copied to Worker Assets Directory

## Problem

After upgrading to rwsdk beta.31+, deploying a project that uses WASM modules fails with:

```
Uncaught Error: No such module "assets/yoga-ZMNYPE6Z-CP4IUfLV-CP4IUfLV.wasm".
  imported from "index.js"
[code: 10021]
```

WASM files are placed in `dist/client/assets/` but not `dist/worker/assets/`, causing Wrangler to fail validation.

## Context

This regression was introduced in commit `8bf62d98` (#893), which changed SSR bundle wrapping to preserve ES module imports at the top level. As a side effect, WASM imports like `import "./assets/yoga-....wasm"` are now preserved as ES module imports in the worker bundle.

However, PR #903 updated `moveStaticAssetsPlugin` to move **all** static assets (except `.js` and `.map` files) from `dist/worker/assets/` to `dist/client/assets/`. This was done to fix font loading issues, but it inadvertently moves WASM files that are needed by worker code.

## Hypothesis

The `moveStaticAssetsPlugin` is moving WASM files from `dist/worker/assets/` to `dist/client/assets/`, but WASM files imported by worker code need to remain in the worker assets directory for Wrangler to find them.

## Plan

1. Create a playground example using `workers-og` (which depends on `yoga-wasm-web` and `@resvg/resvg-wasm`) to reproduce the issue
2. Write an e2e test that verifies WASM files are accessible in the worker
3. Confirm the test fails with the current behavior
4. Fix `moveStaticAssetsPlugin` to exclude `.wasm` files from being moved

## Progress

### Created Playground Example

Created `playground/workers-og` based on `hello-world`:
- Added `workers-og` dependency (v0.0.27)
- Created `/og` route that uses `ImageResponse` from `workers-og` to generate an image
- This should trigger WASM imports when the route is accessed

### Created E2E Test

Added test in `playground/workers-og/__tests__/e2e.test.mts`:
- First test checks that WASM files exist in `dist/worker/assets/` after build
- Second test verifies the `/og` endpoint works (which requires WASM files to be accessible)

The first test should fail with the current behavior since `moveStaticAssetsPlugin` moves all `.wasm` files from `dist/worker/assets/` to `dist/client/assets/`.

### Investigation Results

The initial diagnostic plugin proved to be overly complex. A much simpler and more direct approach was discovered by enabling Vite's built-in SSR manifest.

By setting `build.ssrManifest: true` in the worker's Vite configuration, a `dist/worker/.vite/ssr-manifest.json` file is generated. This manifest provides a complete and accurate map from every module in the graph to all of its transitive asset dependencies, including fonts imported via CSS `@import` statements.

For example, the manifest entry for `"src/app/styles.css?url"` contains a direct list of all font files (`.woff`, `.woff2`) and the final CSS file that it depends on.

### Final Approach: Using the SSR Manifest

The `ssrManifest` provides a complete and accurate map from every module in the graph to all of its transitive asset dependencies. This discovery dramatically simplifies the solution. The definitive plan is:

1.  **Enable `ssrManifest: true`** in the worker's build configuration within `configPlugin.mts`.
2.  **Refactor `moveStaticAssetsPlugin.mts`** to:
    *   Read the `dist/worker/.vite/ssr-manifest.json` file during the `linker` pass.
    *   Identify all assets associated with `?url` imports by iterating through the manifest keys.
    *   Move only those identified assets from `dist/worker/assets` to `dist/client/assets`.
    *   Delete the `ssr-manifest.json` file after it has been used to avoid shipping it in the final bundle.
3.  **Disable Worker Manifest:** Set `build.manifest: false` for the worker build, as it's no longer needed for this process, further reducing unnecessary output.

This approach is robust, simple, and leverages Vite's internal dependency mapping. All worker-scoped assets (like WASM) that are not part of a `?url` import chain will be correctly left in the `dist/worker/assets` directory.

---

## Problem

Production builds fail for projects that use WebAssembly (WASM) because `.wasm` files, imported by worker-side code, are incorrectly moved out of the worker's asset directory.

This issue stems from the `moveStaticAssetsPlugin`, which was originally designed to move client-side assets like CSS and fonts from the worker build output to the client build output. Its rule—to move any non-JS asset—was too broad and failed to distinguish between public assets needed by the client and private assets needed by the worker. This caused a regression where `.wasm` files required by the worker were moved, making them unavailable at runtime and causing deployment validation to fail.

## Solution

The asset moving logic was refined to be more precise by leveraging Vite's SSR manifest, which provides an accurate map of all transitive asset dependencies for each module.

1.  **Enable SSR Manifest:** The worker build configuration was updated to generate an `ssr-manifest.json` file by setting `build.ssrManifest: true`. This manifest correctly tracks all assets, including transitive ones like fonts imported from CSS.

2.  **Update Asset Moving Plugin:** The `moveStaticAssetsPlugin` was refactored to use this manifest. Instead of moving all non-JS assets, it now:
    *   Reads the `ssr-manifest.json`.
    *   Identifies assets that are dependencies of any module imported with a `?url` suffix (the explicit marker for a public, client-facing asset).
    *   Moves *only* these identified public assets to the client's asset directory.

3.  **Cleanup:** After the assets are moved, the now-unnecessary `ssr-manifest.json` file is deleted to keep the final bundle clean. The standard worker `manifest.json` was also disabled as it was no longer needed for this process.

This change ensures that worker-internal assets like `.wasm` files remain in the worker's directory, while public assets like CSS and fonts are correctly moved to the client directory, resolving the build failure.

