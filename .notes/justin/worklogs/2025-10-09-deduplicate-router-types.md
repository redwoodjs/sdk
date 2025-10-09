# Deduplicate Router Types

## Problem

The types `RwContext`, `DocumentProps`, and `LayoutProps` are defined in both `sdk/src/runtime/lib/router.ts` and `sdk/src/runtime/lib/rwContext.ts`. This duplication can lead to inconsistencies. The file `rwContext.ts` is also poorly named as it contains more than just the `RwContext` type.

## Plan

1.  Create a single source of truth for these shared types.
2.  Rename `sdk/src/runtime/lib/rwContext.ts` to a more appropriate name like `sdk/src/runtime/lib/types.ts`.
3.  Compare the duplicate type definitions, merge any differences, and place the consolidated types in the new file.
4.  Remove the duplicate type definitions from `sdk/src/runtime/lib/router.ts`.
5.  Update all imports to reference the new types file.

## PR Description

This change consolidates duplicated types into a single source of truth. The `RwContext`, `DocumentProps`, and `LayoutProps` types were previously defined in both `sdk/src/runtime/lib/router.ts` and `sdk/src/runtime/lib/rwContext.ts`.

To resolve this, `sdk/src/runtime/lib/rwContext.ts` has been renamed to `sdk/src/runtime/lib/types.ts` to better reflect its broader content. The duplicate definitions in `sdk/src/runtime/lib/router.ts` have been removed, and all imports now point to the new `types.ts` file. This ensures these core types are maintained in a single location.

## Build Fixes

After the initial changes, the build failed due to missing imports and incomplete `RwContext` objects. The following fixes were applied:

1. Added missing React import to `types.ts`
2. Updated all import statements that referenced the old `router.ts` exports to use `types.ts`
3. Added missing `entryScripts` and `inlineScripts` properties to `RwContext` objects in `worker.tsx` and `router.test.ts`

The build now completes successfully.
