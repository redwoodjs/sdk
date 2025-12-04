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

## Deeper Analysis: Refining Asset Placement Logic

After reproducing the issue, it's clear the asset placement logic can be refined. The `moveStaticAssetsPlugin` was introduced to handle a specific case (moving CSS files), but its general rule needs adjustment for cases like WASM modules.

The build process needs to handle two types of assets that originate from the worker build pass:

1.  **Worker-scoped assets:** Modules intended for use by the worker runtime itself (e.g., a WASM module for server-side computation).
2.  **Client-scoped assets:** Assets referenced by server-side code that need to be served to the browser (e.g., CSS, fonts, images).

The current plugin uses a file-extension-based rule for placement. This generalization works for many cases but doesn't account for worker-scoped assets like WASM, which leads to them being moved incorrectly.

### Transitive and Contextual Dependencies

Asset placement is also influenced by how files are imported:

-   **Transitive Dependencies:** A server-side module might import a CSS file with a `?url` suffix. That CSS file might then `@import` a font. The font is a transitive dependency that also needs to be placed in the client's public asset directory.
-   **Import Context:** The import statement itself signals the intended use. `import './module.wasm'` is a standard import for runtime logic. In contrast, `import './styles.css?url'` is a Vite-specific pattern to request a public URL, indicating the asset is for the client.

### A More Precise Approach: Analyzing the Import Graph

A more precise method for placing assets is to analyze the import graph. This allows the build process to follow the chain of dependencies and understand the context of each asset.

The revised plan is:

1.  **Identify Public Asset Imports:** Use the `?url` suffix on an import as a clear indicator that an asset (and its dependencies) is client-scoped.

2.  **Trace the Graph:** Within a Vite plugin, use the `generateBundle` hook to access the module graph. For each emitted asset, traverse its importers.

3.  **Identify Public Assets:** If an asset's import chain originates from a module imported with `?url`, that asset is considered public.

4.  **Refine the `moveStaticAssetsPlugin`:** The plugin's role would change. It would no longer use a file-extension rule. Instead, it would move only the assets identified as public from the previous step.

**Outcome:**

-   A WASM module imported for worker logic would not be identified as public and would remain in `dist/worker/assets`.
-   A CSS file imported with `?url` would be identified as public. It, and any fonts it imports, would be moved to `dist/client/assets`.

This method aligns the build output with the intent expressed in the code, leading to more predictable and correct asset placement.

## Next Step: Investigate `fontsource-css-imports` Build

To validate this approach, the next step is to perform a detailed analysis of the `fontsource-css-imports` playground example. This will provide concrete data on how Vite and Rollup handle transitive asset dependencies.

The plan is to:
1. Run a production build (`pnpm build`) on the `fontsource-css-imports` playground.
2. Inspect the generated `dist/worker/assets` and `dist/client/assets` directories.
3. Analyze the Rollup bundle information available in a custom plugin's `generateBundle` hook. This is to confirm that the module graph contains the necessary information to trace an imported font file back to the `styles.css?url` import in `Document.tsx`.

This investigation will confirm if the proposed import graph analysis is feasible with the information Vite provides.

