# Learnings: lucide-react v1.7.0 Scanner Path Mismatch

**Date**: 2026-03-31
**Branch**: `kindling/2026-03-31-2214-fix-barrel-path-format-mismatch-7ad9`
**Analyst**: Phase 1 Investigation

## What Was Investigated

The directive scanner generates barrel files (`generateVendorBarrelContent`) where the import path and export key use **different path formats** for the same file. This was suspected to cause lucide-react v1.7.0 scanner crashes.

## Data Flow (Verified by Code Reading)

1. **`runDirectivesScan.mts` line 389**: When a `use client` directive is found:
   ```typescript
   clientFiles.add(normalizeModulePath(realPath, rootConfig.root));
   ```
   Files are stored in `clientFiles` using `normalizeModulePath` **without** `{ absolute: true }`. This produces **Vite-style paths** like `/node_modules/lucide-react/dist/esm/icons/home/index.js`.

2. **`generateVendorBarrelContent` lines 22-33**:
   ```typescript
   // Line 22: import uses { absolute: true } → produces absolute path
   `import * as M${i} from '${normalizeModulePath(file, projectRootDir, { absolute: true })}';`

   // Line 33: export key uses no absolute flag → produces Vite-style path
   `  '${normalizeModulePath(file, projectRootDir)}': M${i},`
   ```

3. **`createDirectiveLookupPlugin.mts` line 32**: The lookup map uses the `clientFiles` string as the key:
   ```typescript
   `"${file}": () => import("rwsdk/__vendor_client_barrel").then(m => m.default["${file}"])`
   ```

## Reproduction Script Output

```
Simulated file in clientFiles Set: /node_modules/lucide-react/dist/esm/icons/home/index.js

Barrel IMPORT path  (absolute: true):
  /Users/test/project/node_modules/lucide-react/dist/esm/icons/home/index.js

Barrel EXPORT key    (no absolute flag):
  '/node_modules/lucide-react/dist/esm/icons/home/index.js'

MISMATCH DETECTED: true
```

## Key Findings

### Finding 1: The lookup map key format is Vite-style (not absolute)

The lookup map uses `clientFiles` values as keys (verified at `createDirectiveLookupPlugin.mts:32`). Since `clientFiles` stores Vite-style paths (no `{ absolute: true }` in `runDirectivesScan.mts:389`), the lookup map key format is `/node_modules/...`.

### Finding 2: The barrel export key format is Vite-style (correct)

`generateVendorBarrelContent` line 33 calls `normalizeModulePath(file, projectRootDir)` without `{ absolute: true }`. For `node_modules` paths, this returns `/node_modules/...` (Vite-style). This **matches the lookup map key**.

**Evidence**: Both use the same call: `normalizeModulePath(file, projectRootDir)` on the same `files` set.

### Finding 3: The barrel import path format is absolute (the inconsistency)

Line 22 adds `{ absolute: true }`, producing `/Users/test/project/node_modules/...`. This is a different string from the export key `/node_modules/...`.

**Evidence**: Reproduction script confirms the two formats differ for the same input file.

### Finding 4: The import format does not break runtime resolution

The import path (as a string literal) is resolved by Node.js/Vite at module load time. Both absolute and Vite-style paths resolve to the same filesystem location. The absolute path `/Users/test/project/node_modules/lucide-react/index.js` is a valid Node.js import for the file at that location. However, for self-consistency, both should use the same format.

### Finding 5: Option B (remove `{ absolute: true }` from import) is correct

**Rationale**:
- The barrel export key uses Vite-style (confirmed correct, matches lookup map)
- The barrel import should use the same Vite-style format for self-consistency
- The `{ absolute: true }` flag on the import is unnecessary and creates the inconsistency
- Removing it makes the barrel fully self-consistent: both import source and export key for the same file use identical normalized paths

**What NOT to do**: Option A (adding `{ absolute: true }` to the export key call) would break the barrel because the lookup map key uses Vite-style paths. If the export key becomes absolute, it would no longer match `m.default["/node_modules/..."]` from the lookup.

## Same Pattern in `generateAppBarrelContent`

`generateAppBarrelContent` (lines 41-54) uses `{ absolute: true }` for its import paths (line 48). However, app barrel files are not used for named exports (they just emit side-effect `import "..."` statements), so this pattern is less problematic there. Still worth aligning for consistency.

## Test Coverage Gap

`directiveModulesDevPlugin.test.mts` has a test at lines 17-25 that validates the current (mismatched) behavior. The test passes because it validates the output string without ever loading the barrel as a module. This is the "existing 458 tests pass" observation from the brief.

The test will need to be updated when the fix is applied, as it expects the mismatched format.

## Recommendation for Developer

**Fix**: Remove `{ absolute: true }` from `generateVendorBarrelContent` line 22:
```typescript
// Before (mismatched):
`import * as M${i} from '${normalizeModulePath(file, projectRootDir, { absolute: true })}';`

// After (aligned):
`import * as M${i} from '${normalizeModulePath(file, projectRootDir)}';`
```

Also apply the same alignment to `generateAppBarrelContent` line 48.

The test at `directiveModulesDevPlugin.test.mts` lines 18-19 expects absolute imports. Update it to expect Vite-style imports matching the export keys.

## Files Reviewed

- `sdk/src/vite/directiveModulesDevPlugin.mts` — barrel generation (lines 14-54)
- `sdk/src/vite/createDirectiveLookupPlugin.mts` — lookup map generation (lines 10-48)
- `sdk/src/vite/runDirectivesScan.mts` — how `clientFiles` is populated (lines 387-394)
- `sdk/src/lib/normalizeModulePath.mts` — path normalization logic
- `sdk/src/vite/directiveModulesDevPlugin.test.mts` — existing tests

## Reproduction Artifacts

- `sdk/src/vite/_repro_path_mismatch.mts` — standalone script demonstrating the mismatch
