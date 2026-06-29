# Issue #1250 — Allow opting `node_modules` directive files out of the dev vendor barrel

## Problem

In dev, RedwoodSDK routes every `"use client"` / `"use server"` file in
`node_modules` through a pre-bundled **vendor barrel**. The barrel is processed
by Vite's dependency optimizer (esbuild), which runs RedwoodSDK's directive
transforms but does **not** run arbitrary host Vite plugins.

For a meta-framework or component library that ships raw ESM source and relies
on the host's Vite pipeline (e.g. per-component CSS-in-JS transforms), this
means the transform never runs in dev.

## Current behavior

- `generateLookupMap` in `sdk/src/vite/createDirectiveLookupPlugin.mts` checks
  `file.includes("node_modules")` and, in dev, routes matched files to the
  barrel.
- `generateVendorBarrelContent` in
  `sdk/src/vite/directiveModulesDevPlugin.mts` builds the barrel from the same
  `node_modules` filter.
- `forceClientPaths` / `forceServerPaths` only add files to the client/server
  sets; they do not change how the files are served.

## Reproduction

Created `sdk/playground/vendor-barrel-source-repro`.

- `packages/my-ui-lib/src/button.tsx` is a `"use client"` component installed
  into `node_modules/my-ui-lib` via a `file:` dependency.
- `vite.config.mts` defines a host Vite plugin that injects a CSS import and a
  client-side console marker for any file inside `node_modules/my-ui-lib`.
- `src/app/pages/Home.tsx` imports and renders `MyButton`.

### Verified buggy behavior

Running `pnpm dev` and requesting the page renders the button, but the host
plugin's `transform` hook never fires:

```
# NOT present in server output:
[host-transform] Running host transform for .../node_modules/my-ui-lib/src/button.tsx
```

The injected CSS (red background) is also absent from the SSR HTML.

This confirms the component is being served from the vendor barrel, bypassing
the host's Vite pipeline.

## Proposed fix direction from the issue

Add a `forceSourcePaths` option to `redwoodPlugin`:

1. Resolve patterns through the same `resolveForcedPaths` pipeline used by
   `forceClientPaths`.
2. In `generateLookupMap`, matched files take the existing source-import branch
   even when they live in `node_modules`.
3. In `generateVendorBarrelContent`, exclude matched files from the barrel.
4. Supporting fix: strip Vite optimizer query strings (e.g. `?v=<hash>`) before
   `normalizeModulePath` in `directivesPlugin`, so source-served modules
   referenced through optimized chunks still register their client/server
   reference ids under the clean lookup key.

## Open questions / concerns

1. **Vite may still pre-bundle source-served files.** Even with the lookup-map
   fix, Vite's dependency optimizer could still process the file unless the
   package is also in `optimizeDeps.exclude`. The cleanest API may be to honor
   `optimizeDeps.exclude` as an implicit source-path signal, or to auto-exclude
   matched packages when `forceSourcePaths` is used.
2. **Query stripping should be robust.** Only stripping `?v=<hash>` may not be
   enough; Vite also uses `?import`, `?t=<timestamp>`, `?raw`, etc. Consider
   stripping the query segment entirely when computing lookup keys.
3. **API symmetry.** RedwoodSDK has `forceClientPaths` and `forceServerPaths`.
   A single `forceSourcePaths` that applies to both is simple but not symmetric.
   Consider `forceClientSourcePaths` / `forceServerSourcePaths`.
4. **SSR bridge path.** Source-served `node_modules` client components will now
   load through `ssrLoadModule` / the SSR bridge, which is currently exercised
   for app source files but not for `node_modules` directive files in dev.

## Next steps

- Decide on API shape (`forceSourcePaths` vs. per-kind options vs. honoring
  `optimizeDeps.exclude`).
- Implement lookup-map / barrel exclusion and query stripping.
- Add unit tests for `generateLookupMap` and `generateVendorBarrelContent`.
- Verify the repro shows the host transform and red background after the fix.
