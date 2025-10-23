## Problem

The Vite dev server fails during dependency optimization when a runtime helper in our SDK imports `vite`. This triggers a chain reaction where Vite's optimizer tries to resolve `lightningcss`, which contains a problematic `require('../pkg')` statement that fails because the target directory doesn't exist in the published package. This happens even if the project doesn't use `lightningcss` directly.

## Plan

The proposed solution is to remove the top-level `vite` import from the runtime utility that's causing the issue. The utility, `normalizeModulePath.mts`, only uses `normalizePath` from Vite, which is a simple path separator normalization function.

1.  Replace the `vite` import in `sdk/src/lib/normalizeModulePath.mts` with a local implementation of the path normalization logic.
2.  This will prevent `vite` from being pulled into the dependency optimization graph, breaking the chain that leads to the `lightningcss` resolution error.

## Context

- Bug report: (link to user's message)
- `lightningcss` issue: https://github.com/parcel-bundler/lightningcss/issues/701
- `tsdown` issue showing similar bundler problems: https://github.com/rolldown/tsdown/issues/212

## Attempt 1: Remove `vite` import

I'm replacing the import of `normalizePath` from `vite` in `sdk/src/lib/normalizeModulePath.mts` with a local implementation. This avoids pulling `vite` into the dependency optimization graph, which should prevent the `lightningcss` resolution issue.

The change is straightforward:

```typescript
// sdk/src/lib/normalizeModulePath.mts
- import { normalizePath as normalizePathSeparators } from "vite";
+ const normalizePathSeparators = (id: string) => id.replace(/\\/g, "/");
```

This seems to be the correct fix based on the detailed bug report.
