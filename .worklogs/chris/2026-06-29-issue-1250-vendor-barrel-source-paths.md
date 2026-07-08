# Issue #1250 — Allow opting `node_modules` directive files out of the dev vendor barrel

## Problem

In dev, RedwoodSDK routes every `"use client"` / `"use server"` file in
`node_modules` through a pre-bundled **vendor barrel**. The barrel is processed
by Vite's dependency optimizer (esbuild/Rolldown), which runs RedwoodSDK's
directive transforms but does **not** run arbitrary host Vite plugins.

For a meta-framework or component library that ships raw ESM source and relies
on the host's Vite pipeline (e.g. a CSS-in-JS transform that emits a
per-component CSS import at build time), this means the transform never runs in
dev.

## Reproduction

Created `sdk/playground/optimize-deps-exclude-directives`.

- `packages/my-ui-lib/src/button.tsx` is a `"use client"` component installed
  into `node_modules/my-ui-lib` via a `file:` dependency.
- `vite.config.mts` defines a host Vite plugin that injects a marker log and a
  `import "./button.css"` into every `my-ui-lib` module.
- `src/app/pages/Home.tsx` imports and renders `MyButton`.
- The config sets `optimizeDeps.exclude: ["my-ui-lib"]`.

### Before the fix

- The terminal does **not** show `[host-transform] Running host transform for .../my-ui-lib/src/button.tsx`.
- The browser console does **not** show the client-side marker.
- The button renders without the red background.

### After the fix

- The terminal shows the host transform log.
- The browser console shows the client-side marker.
- The button renders with a red background (client-side injected in dev;
  `<link>` tag in production).

## Implementation

Instead of serving raw-source `node_modules` files directly from source, the fix
honors Vite's `optimizeDeps.exclude` by moving excluded directive files out of
the pre-bundled **vendor barrel** and into the **app barrel**. The app barrel
flows through the host's normal Vite plugin pipeline, so host transforms run.

### Files changed

- `sdk/src/vite/resolveOptimizeDepsExcludes.mts` (new)
  - Resolves `optimizeDeps.exclude` entries to absolute filesystem roots.
  - Handles bare packages, scoped packages, package subpaths, relative paths,
    and absolute paths.
  - Resolves symlinked workspace packages (e.g. `file:./packages/my-ui-lib`) to
    their real location on disk.
  - Provides `isExcludedFromOptimization(file, excludedRoots, projectRootDir)`.
  - `isExcludedFromOptimization` now also resolves Vite-style project-relative
    paths such as `/node_modules/foo/index.js` against `projectRootDir`, so
    packages physically installed under `node_modules` are correctly matched.

- `sdk/src/vite/directiveModulesDevPlugin.mts`
  - Reads `config.optimizeDeps.exclude` in `configResolved` and resolves roots.
  - Merges root-level and per-environment `optimizeDeps.exclude` for Vite 8.
  - `generateVendorBarrelContent` now skips files under excluded roots.
  - `generateAppBarrelContent` now includes both app files and excluded
    `node_modules` files, so they are processed through the app barrel pipeline.

- `sdk/src/vite/createDirectiveLookupPlugin.mts`
  - Reads `config.optimizeDeps.exclude` in the `config` hook and resolves roots.
  - Merges root-level and per-environment `optimizeDeps.exclude` for Vite 8.
  - In `generateLookupMap`, excluded `node_modules` files take the source-import
    branch instead of the vendor-barrel branch (the app barrel already ensures
    they are part of the normal pipeline).


### Tests

- `sdk/src/vite/createDirectiveLookupPlugin.test.mts`
  - Added test for source-serving files under excluded roots.

- `sdk/src/vite/directiveModulesDevPlugin.test.mts`
  - Added tests for excluding files from the vendor barrel and including them in
    the app barrel.
  - Added tests for Vite-style `/node_modules/...` paths and for transitive
    dependencies.

- `sdk/src/vite/resolveOptimizeDepsExcludes.test.mts` (new)
  - Tests package root resolution and the exclusion helper.
  - Tests Vite-style project-relative path matching.
  - Tests collection of root-level and per-environment excludes.

## Why the app barrel approach

Serving excluded `node_modules` files directly from source works, but it pushes
them outside RedwoodSDK's barrel machinery. By moving them into the app barrel
instead, they stay within the same pipeline as the app's own directive files:

- They are processed by the host's Vite plugins (the app barrel is not
  pre-bundled by the dependency optimizer).
- They are included in the normal module graph for the target environment.
- Production builds still emit CSS chunks into the manifest as expected.

## Verification

- `pnpm vitest --run -- createDirectiveLookupPlugin.test.mts directiveModulesDevPlugin.test.mts resolveOptimizeDepsExcludes.test.mts`
  passes.
- Full SDK test suite passes.
- `pnpm test:e2e -- optimize-deps-exclude-directives` dev test passes (deployment
  test is skipped locally due to missing Cloudflare auth).
- `pnpm build` in the repro produces a `dist/client/assets/button-*.css` chunk
  and the manifest correctly associates it with
  `packages/my-ui-lib/src/button.tsx`.

## Known limitations

- **Dev SSR stylesheets.** In dev, RedwoodSDK's `Stylesheets` component relies
  on the production manifest, which is empty in dev. CSS imported by a
  source-served client component is injected client-side by Vite during
  hydration, so it will not appear in the SSR HTML. Production builds include
  the CSS in the manifest and emit the expected `<link rel="stylesheet">` tags.

- **Transitive dependencies.** Only packages explicitly listed in
  `optimizeDeps.exclude` are moved into the app barrel. A transitive dependency
  whose directive files also need host transforms must be excluded separately.
  This mirrors Vite's own semantics.
