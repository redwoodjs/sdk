# Investigate FOUC in Production Starter App

## Task Narrative

A user reported a Flash of Unstyled Content (FOUC) when deploying a fresh `create-rwsdk` project. The CSS loads separately rather than blocking in `<head>` as expected. The issue reproduces both in dev (`pnpm dev`) and in production (`pnpm release` to Cloudflare Workers). The user referenced PR #638 as a possible regression source, but we are told not to be misled by that -- #638 was largely about dev, while this issue manifests in production.

**Repro steps** (from the report):
1. `pnpx create-rwsdk my-project-name`
2. `cd my-project-name && pnpm i`
3. `pnpm dev` (FOUC happens)
4. `pnpm release` (FOUC happens at deployed URL)

The critical concern is production. FOUC in dev is a known, accepted trade-off (documented in `docs/architecture/clientStylesheets.md`).

## Synthesized Context

### How CSS Prevention Works in Production (from `docs/architecture/clientStylesheets.md`)

The system has a two-phase approach:

**Phase 1 - Script Discovery**: Two mechanisms populate `requestInfo.rw.scriptsToBeLoaded`:
- **Static entry points**: `transformJsxScriptTagsPlugin` (`sdk/src/vite/transformJsxScriptTagsPlugin.mts`) parses `<script>` and `<link rel="modulepreload">` tags in Document.tsx at build time. It wraps JSX calls with side effects like `requestInfo.rw.scriptsToBeLoaded.add("/src/client.tsx")`.
- **Dynamic components**: `registerClientReference` (`sdk/src/runtime/register/worker.ts`) intercepts the `$$id` getter on client references. When the RSC stream serializes a "use client" component, accessing `$$id` adds the module ID to `scriptsToBeLoaded`.

**Phase 2 - Stylesheet Injection**: The `Stylesheets` component (`sdk/src/runtime/render/stylesheets.tsx`) iterates `scriptsToBeLoaded`, looks up each module in the Vite manifest to find associated CSS files, and renders `<link rel="stylesheet" href={href} precedence="first" />` tags.

**Phase 3 - React 19 Hoisting**: The `precedence="first"` attribute causes React 19 to hoist `<link>` tags into `<head>` during SSR streaming, even though `Stylesheets` renders inside `<body>` (as a child of Document's `{children}`).

### Rendering Pipeline (from `sdk/src/runtime/render/renderDocumentHtmlStream.tsx`)

1. RSC payload stream is fully consumed via `await createThenableFromReadableStream(rscPayloadStream)` -- this ensures all `registerClientReference` `$$id` getters have fired
2. Document element is created with `<Stylesheets>` and `<Preloads>` as children
3. Document is rendered to HTML stream via `renderHtmlStream`
4. App HTML stream is rendered separately
5. Both streams are stitched together via `stitchDocumentAndAppStreams`

### The Starter Template (from `starter/src/app/`)

- `document.tsx`: Contains `<link rel="modulepreload" href="/src/client.tsx" />` in `<head>` and `<script>import("/src/client.tsx")</script>` in `<body>`
- `pages/welcome.tsx`: A `"use client"` component importing `welcome.module.css` (CSS Modules)
- `pages/Home.tsx`: Server component rendering `<Welcome />`

### Manifest Handling (from `sdk/src/runtime/lib/manifest.ts`, `sdk/src/vite/linkerPlugin.mts`)

- In dev: `getManifest()` returns `{}` (empty) -- no CSS links rendered server-side (known trade-off)
- In production: The string `"__RWSDK_MANIFEST_PLACEHOLDER__"` is replaced by the linker plugin with the actual Vite client manifest JSON
- The linker reads the client manifest from disk and replaces the placeholder in the worker bundle

## Known Unknowns

1. **Manifest content**: What does the production manifest actually contain? Do the keys match what `scriptsToBeLoaded` stores? A key mismatch (e.g. `/src/app/pages/welcome.tsx` vs `src/app/pages/welcome.tsx`) would cause `findCssForModule` to return no CSS.

2. **React 19 `precedence` hoisting in streaming SSR**: Does React's `precedence` attribute actually hoist `<link>` tags to `<head>` during `renderToReadableStream`? Or does it only work during client-side rendering? If it doesn't hoist during SSR, the `<link>` tags would end up in `<body>`, which is non-blocking and causes FOUC.

3. **Stream stitching interaction**: Could `stitchDocumentAndAppStreams` interfere with where the `<link>` tags end up in the final HTML? The stitcher has specific logic for handling `<head>` content.

4. **What the actual HTML response looks like**: We need to inspect the raw HTML from a production deployment to see where (if at all) the `<link rel="stylesheet">` tags appear.

5. **`scriptsToBeLoaded` population timing**: Is `scriptsToBeLoaded` actually populated by the time `Stylesheets` renders? The RSC stream is awaited first, but we should verify the `$$id` getter actually fires during stream consumption.

6. **CSS module specifics**: The starter uses CSS Modules (`welcome.module.css`), not plain CSS. Does the manifest handle these differently?

## Investigation: Deployed HTML and Manifest Key Mismatch

### Deployed fouc-repro to Cloudflare Workers

Created `playground/fouc-repro` by copying `hello-world` and adding a `"use client"` component (`Welcome.tsx`) with CSS Modules import, matching the starter template pattern.

Built and deployed to `https://fouc-repro.redwoodjs.workers.dev/`.

### HTML Response Analysis

Fetched raw HTML via `curl`. Key observations:

1. **No `<link rel="stylesheet">` tag anywhere in the response** -- the `Stylesheets` component rendered nothing
2. CSS module class names are correctly applied in the SSR output (e.g., `class="_container_yaxpn_1"`) -- SSR bridge is working fine for class name resolution
3. The CSS file (`Welcome-DfGrmhxX.css`) exists in the build output but is never referenced in the HTML
4. CSS only loads when client JS executes: browser loads `client-CGCk5-s-.js` -> dynamically imports `Welcome-CskV7DQb.js` -> that imports the CSS -> FOUC

### Root Cause: Leading Slash Mismatch Between `scriptsToBeLoaded` IDs and Manifest Keys

**Evidence:**

The built worker bundle (`dist/worker/index.js`) contains:
- `scriptsToBeLoaded.add("/src/client.tsx")` -- leading slash (from `transformJsxScriptTagsPlugin`)
- `registerClientReference` uses IDs like `"/src/app/pages/Welcome.tsx"` -- leading slash (from `normalizeModulePath`)

The Vite client manifest (`dist/client/.vite/manifest.json`) uses keys like:
- `"src/app/pages/Welcome.tsx"` -- **no leading slash**
- `"src/client.tsx"` -- **no leading slash**

The `findCssForModule` function in `stylesheets.tsx` does a direct lookup: `manifest[scriptId]`. Since `"/src/app/pages/Welcome.tsx" !== "src/app/pages/Welcome.tsx"`, the lookup silently returns no CSS.

**Where the leading slash comes from:**

`normalizeModulePath` (`sdk/src/lib/normalizeModulePath.mts`, line 113) always returns `"/" + cleanRelative` for paths within the project root. This is the Vite-style convention (Vite uses leading-slash paths internally). However, Vite's `manifest.json` uses paths **without** leading slashes.

**Scope of the bug:**

This affects both:
- Static entry points (from `transformJsxScriptTagsPlugin`): `scriptsToBeLoaded.add("/src/client.tsx")`
- Dynamic components (from `registerClientReference`): `scriptsToBeLoaded.add("/src/app/pages/Welcome.tsx")`

Both use `normalizeModulePath` which produces leading-slash IDs. Neither matches the manifest key format.

## Fix Applied

Added a `toManifestKey` helper that strips the leading `/` before looking up module IDs in the Vite manifest. Applied to both:

1. `sdk/src/runtime/render/stylesheets.tsx` -- `findCssForModule` now uses `manifest[toManifestKey(id)]`
2. `sdk/src/runtime/render/preloads.tsx` -- `findScriptForModule` now uses `manifest[toManifestKey(id)]`

The fix is minimal and local to the lookup site, avoiding changes to the broader `normalizeModulePath` contract (which other consumers depend on).

## Verification

After rebuilding the SDK (`cd sdk && pnpm build`) and redeploying the fouc-repro playground, the FOUC is resolved. The `<link rel="stylesheet">` tags now appear in the HTML response, loaded as render-blocking resources in `<head>` via React 19's `precedence="first"` hoisting.

## E2E Test Added

Added `playground/fouc-repro/__tests__/e2e.test.mts` with two tests:

1. `testDevAndDeploy("renders page with styled content")` -- basic smoke test, verifies content renders
2. `testDeploy("production HTML includes stylesheet link to prevent FOUC")` -- the FOUC regression test

The FOUC test disables JavaScript in the Puppeteer page before navigating, so only the server-rendered HTML is present. It then asserts that a `<link rel="stylesheet" href="...css">` tag exists in the HTML. This is deploy-only (`testDeploy`) since dev intentionally has no server-side stylesheet injection (accepted trade-off documented in `docs/architecture/clientStylesheets.md`).

Playground later renamed from `fouc-repro` to `css` to serve as a broader CSS test surface.

## Knowledge Extraction

Promoted to `.docs/learnings/`:
- `vite-manifest-key-format.md` -- Vite manifest keys lack leading slashes, while `normalizeModulePath` produces them
- `e2e-fouc-test-pattern.md` -- Pattern for testing FOUC: disable JS in Puppeteer, assert `<link>` in SSR HTML

## Draft PR

### Problem

Production builds suffered from a Flash of Unstyled Content (FOUC). The `Stylesheets` and `Preloads` components failed to render `<link>` tags in the server-sent HTML, causing CSS to load only after client JavaScript executed.

### Solution

The root cause was a key format mismatch between module IDs in `scriptsToBeLoaded` and Vite's client manifest. Our `normalizeModulePath` returns Vite-style paths with a leading slash (`/src/app/pages/Welcome.tsx`), but Vite's `manifest.json` keys omit the leading slash (`src/app/pages/Welcome.tsx`). The direct `manifest[scriptId]` lookup in both `findCssForModule` and `findScriptForModule` silently missed every entry.

We added a `toManifestKey` helper that strips the leading slash before manifest lookups, in both `stylesheets.tsx` and `preloads.tsx`. We also added a `playground/css` e2e test that verifies the production HTML contains a `<link rel="stylesheet">` tag by navigating with JavaScript disabled.
