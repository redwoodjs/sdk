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