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

Created `playground/wasm-repro` based on `hello-world`:
- Added `workers-og` dependency (v0.0.27)
- Created `/og` route that uses `ImageResponse` from `workers-og` to generate an image
- This should trigger WASM imports when the route is accessed

### Created E2E Test

Added test in `playground/wasm-repro/__tests__/e2e.test.mts`:
- First test checks that WASM files exist in `dist/worker/assets/` after build
- Second test verifies the `/og` endpoint works (which requires WASM files to be accessible)

The first test should fail with the current behavior since `moveStaticAssetsPlugin` moves all `.wasm` files from `dist/worker/assets/` to `dist/client/assets/`.

### Investigation Results

The initial diagnostic plugin proved to be overly complex. A much simpler and more direct approach was discovered by enabling Vite's built-in SSR manifest.

By setting `build.ssrManifest: true` in the worker's Vite configuration, a `dist/worker/.vite/ssr-manifest.json` file is generated. This manifest provides a complete and accurate map from every module in the graph to all of its transitive asset dependencies, including fonts imported via CSS `@import` statements.

For example, the manifest entry for `"src/app/styles.css?url"` contains a direct list of all font files (`.woff`, `.woff2`) and the final CSS file that it depends on.

### Final Approach: Using the SSR Manifest

This discovery dramatically simplifies the solution and removes the need for manual graph traversal or CSS parsing. The definitive plan is now:

1.  **Enable `ssrManifest: true`** in the worker's build configuration within `configPlugin.mts`.
2.  **Refactor `moveStaticAssetsPlugin.mts`** to implement the following logic:
    *   Read the `dist/worker/.vite/ssr-manifest.json` file.
    *   Initialize an empty `Set` to store the filenames of public assets.
    *   Iterate through all the entries in the manifest.
    *   For any entry whose key includes the `?url` suffix, add all the asset file paths from its corresponding array to the `Set` of public assets.
    *   Filter the files in `dist/worker/assets` against this `Set`.
    *   Move only the files that are present in the `Set` to `dist/client/assets`.

This approach is robust, simple, and leverages Vite's internal dependency mapping, ensuring a correct and maintainable solution. All worker-scoped assets (like WASM) that are not part of a `?url` import chain will be correctly left in the `dist/worker/assets` directory.

