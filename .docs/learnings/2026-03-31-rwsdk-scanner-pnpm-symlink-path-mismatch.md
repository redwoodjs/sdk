# Learning: rwsdk Directive Scanner Path Key Mismatch Under pnpm

**Date**: 2026-03-31
**Severity**: Latent high-impact bug in pnpm projects
**Triggers**: Any npm dependency with `'use client'` or `'use server'` in a transitive import (not just entry point)

## The Pitfall

rwsdk's directive scanner has two separate code paths that must agree on a module's **path key** (the string that identifies a file in the lookup map and vendor barrel):

- **Scanner path** (`runDirectivesScan.mts` line 382): calls `fsp.realpath()` to resolve symlinks
- **Stub generation path** (`directivesPlugin.mts` line 141): uses `args.path` directly, **without** resolving symlinks

In npm projects with real `node_modules/`, both paths resolve to the same string. **In pnpm projects**, pnpm uses symlinks in `node_modules/` that point into a content-addressable store at `node_modules/.pnpm/`. The two code paths then produce different keys for the same file:

```
Scanner:        /node_modules/.pnpm/lucide-react@1.7.0/.../Icon.js  (real path)
Stub generator: /node_modules/lucide-react/dist/esm/Icon.js         (symlinked path)
                ↑ Mismatch — lookup map has one key, stub embeds the other
```

At runtime, the worker calls `ssrLoadModule()` with the symlinked key, which doesn't exist in the lookup map — crash.

## When It Manifests

The bug is **latent in all pnpm projects** but only **manifests** when a transitive dependency (one that is imported but not the direct entry point) contains a literal `'use client'` or `'use server'` directive.

**Trigger example**: lucide-react v1.7.0 added `'use client'` to `Icon.js` (a transitive file reached via `createLucideIcon.js`). Any project importing a lucide-react icon transitively encounters the directive, and the scanner includes `Icon.js` in its transitive walk — without knowing it will later fail at runtime.

## The Fix

In `directivesPlugin.mts`, apply `fsp.realpath()` before `normalizeModulePath()`:

```typescript
// directivesPlugin.mts, around line 141
// Before:
const normalizedPath = normalizeModulePath(args.path, projectRootDir);

// After:
const realPath = await fsp.realpath(args.path);
const normalizedPath = normalizeModulePath(realPath, projectRootDir);
```

This mirrors what `runDirectivesScan.mts` already does and makes the stub key symmetric with the scanner key.

## Why npm Doesn't Fail

npm's `node_modules/` uses a flat structure with no symlinks (in most cases). For npm, `fsp.realpath(args.path)` is a no-op — it returns the same string. Both code paths produce the same key, so the lookup succeeds.

pnpm's symlink structure exposes the inconsistency; it doesn't create it.

## Prevention

When adding new module resolution code, always ask: "Does this code path assume symlinks are already resolved? Or does it resolve them?" Consistency across all paths that produce lookup keys is critical.
