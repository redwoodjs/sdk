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
