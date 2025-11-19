# Work Log: 2025-11-19 - Fix External Modules in SSR Build

## Problem
We recently fixed an issue in development where platform-specific modules (like `cloudflare:workers`) were not being correctly treated as external when crossing the SSR bridge. This was fixed by modifying the `load` hook in `ssrBridgePlugin` to preserve these imports as bare specifiers in development.

However, we need to ensure the same behavior applies to production builds. In builds, the `ssr` environment is bundled separately. We need to ensure that these platform-specific modules are marked as external in the SSR bundle so they are not attempted to be bundled (which would fail) and remain as external imports.

## Solution
We modified `ssrBridgePlugin.mts` to intercept resolution of these external modules in the `ssr` environment. By checking if a module ID is in `externalModulesSet` and if we are in the `ssr` environment, we explicitly return `{ id, external: true }` from the `resolveId` hook. This prevents Vite/Rollup from trying to bundle them and preserves them as external imports in the final SSR bundle.

This change was applied in the `resolveId` hook, before the `isDev` check, to ensure it covers both development (as a safeguard/consistency) and production builds.

## Handling External Imports in the SSR Bridge Wrapper
After implementing the external fix, the build failed with `ERROR: Unexpected "*"` on the line `import * as cfw from 'cloudflare:workers';`.

This occurred because `configPlugin.mts` wraps the entire SSR bundle in an IIFE to prevent symbol collisions when it's later merged into the worker bundle.
```typescript
// Old implementation:
banner: `export const { ... } = (function() {`,
footer: `return { ... };\n})();`,
```
This resulted in imports being placed inside the function scope, which is a syntax error:
```javascript
export const { ... } = (function() {
  import * as cfw from 'cloudflare:workers'; // Syntax Error
  // ...
})();
```

### The Smarter Wrapping Plugin
To solve this, we replaced the static banner/footer with a dedicated plugin, `ssrBridgeWrapPlugin`.

This plugin:
1. Hooks into `renderChunk`.
2. Scans the code to find the last `import` statement.
3. Injects the "start IIFE" code *after* the last import.
4. Appends the "end IIFE" code at the end of the file.
5. Removes the original export statement from the bundle using a robust regex (`/export\s*\{[\s\S]*?\}\s*;?/`) that handles varied formatting.

This effectively "hoists" the imports outside the IIFE without needing to parse and move them manually. The imports remain at the top level, while the body of the module is wrapped to ensure scope isolation.

## Root Cause: Regex Matching Comments

The initial implementation used simple line-based regex to find import statements, which incorrectly matched import-like text inside comments. For example, a comment containing `import { StyleSheet } from '@emotion/sheet'` was being treated as a real import, causing the IIFE banner to be inserted in the wrong location.

## Solution: AST-Based Parsing

Refactored `ssrBridgeWrapPlugin` to use AST parsing (via `@ast-grep/napi`) to find actual import and export statements, ignoring comments. This ensures we only operate on real code constructs, not text that happens to look like imports/exports in comments.

---

# PR Description: fix(build): Support external modules in SSR bundle

## Problem

Production builds failed when the SSR bridge module contained external imports (e.g., `cloudflare:workers`). This happened for two reasons:
1.  **External Resolution:** The `ssr` environment did not correctly externalize platform-specific modules during the build, attempting to bundle them instead.
2.  **IIFE Wrapping:** The SSR bundle is wrapped in an IIFE to prevent symbol collisions when merged into the worker bundle. The previous wrapping mechanism (simple banner/footer) blindly wrapped the entire file, placing top-level external imports inside the function scope, which is a syntax error.

## Solution

1.  **Explicit Externalization:** Updated `ssrBridgePlugin` to explicitly resolve platform-specific modules as external when running in the `ssr` environment.
2.  **Smart IIFE Wrapping:** Introduced a new `ssrBridgeWrapPlugin` to handle the IIFE injection. Instead of wrapping the whole file, it intelligently locates the last import statement and injects the IIFE start block *after* it. This ensures that external imports remain at the top level while the module body is correctly isolated. The plugin also robustly removes the original export statement to avoid syntax errors.

## Testing

Validated by successfully building a project that imports `cloudflare:workers` in an SSR-rendered component.
