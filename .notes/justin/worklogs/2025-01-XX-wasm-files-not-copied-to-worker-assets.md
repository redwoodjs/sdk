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

