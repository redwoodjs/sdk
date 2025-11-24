# Fontsource CSS Import Issue Reproduction

## Problem

User reported that importing fonts via CSS `@import` statements in `styles.css` works in development but fails in production (Cloudflare Workers). The font files are being bundled to `dist/worker/assets` instead of `dist/client/assets`, causing 404 errors when the browser tries to load them.

The issue:
- Fonts imported via `@import "@fontsource/figtree/400.css"` in CSS work locally
- In production, font files end up in `dist/worker/assets` instead of `dist/client/assets`
- CSS references fonts with `/assets/` URLs that point to files not available to the client
- Browser console shows 404 errors for font files

Workaround discovered by user:
- Import fonts in a "use client" component using `import "@fontsource/figtree/400.css?url"`
- This causes fonts to be bundled in both `dist/client/assets` and `dist/worker/assets`
- Fonts then load correctly in production

## Finding: moveStaticAssetsPlugin

During build, font files (`.woff`, `.woff2`) are placed in `dist/worker/assets/` alongside CSS files. There's a `moveStaticAssetsPlugin` (`sdk/src/vite/moveStaticAssetsPlugin.mts`) that runs during the linker pass to move CSS files from `dist/worker/assets/` to `dist/client/assets/`, but it only moves CSS files:

```22:22:sdk/src/vite/moveStaticAssetsPlugin.mts
const cssFiles = await glob("*.css", { cwd: sourceDir });
```

From the build output, font files like `figtree-latin-400-normal-g7Dtegnw.woff2` and `figtree-latin-400-normal-BD4aNku5.woff` are being placed in `dist/worker/assets/` but not moved to `dist/client/assets/`.

The plugin needs to also move font files (`.woff`, `.woff2`, and potentially other font formats like `.ttf`, `.otf`, `.eot`) to `dist/client/assets/` so they're accessible to the browser.

The plugin runs during the linker pass (`process.env.RWSDK_BUILD_PASS === "linker"`) and is registered in `redwoodPlugin.mts` at line 197.