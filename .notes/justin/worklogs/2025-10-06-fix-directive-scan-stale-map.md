# Fix Directive Scan Stale Map Issue

**Date**: 2025-01-06

## Problem Definition & Goal

The directive scan was becoming stale when new dependency paths were introduced that weren't part of the initial scan. This caused SSR errors like:

```
Internal server error: (ssr) No module found for '/src/app/pages/todos/Todos.tsx' in module lookup for "use client" directive
```

The root cause was that the initial scan only looked at files reachable from entry points, but when new imports were added that created new dependency paths to directive-containing files, the HMR update didn't trigger a re-scan.

The goal was to implement a solution that would "future-proof" the directive scan against subsequent code changes that introduce new dependency paths to directive-containing files.

## Investigation: Understanding the Root Cause

The directive scan operates by traversing the dependency graph starting from entry points (like `worker.tsx`). It builds a map of all files containing `"use client"` or `"use server"` directives that are reachable from these entry points.

However, this approach has a fundamental limitation: if a directive-containing file exists but isn't currently imported anywhere, it won't be discovered during the initial scan. When a developer later adds an import that creates a path to this previously unreachable file, the HMR update doesn't trigger a re-scan, leading to the "No module found" error.

This is particularly problematic in scenarios where:
1. A server component exists initially
2. A client component exists but isn't imported anywhere
3. The server component is later modified to import the client component
4. The directive scan map is now stale and doesn't include the client component

## Attempt 1: Implementing `findDirectiveRoots` with `path.join`

The first approach was to implement a pre-scan function that would find all directive-containing files in the `src` directory using glob patterns, regardless of whether they're currently reachable from entry points.

**Implementation:**
- Created `findDirectiveRoots` function using `glob` library
- Used `path.join` to construct the `cwd` for the glob search
- Scanned for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.mdx` files
- Combined pre-scanned files with original entry points

**Result:** The implementation failed. Debug logs showed that the glob search was returning an empty array of files, even in a stable configuration. This was the "smoking gun," indicating the problem was with the glob pattern or its options, not the overall strategy.

## Attempt 2: Fixing Glob Configuration with `path.resolve`

A search of the git history for previous `glob` implementations surfaced an older, working version in commit `c30a8119`. Comparing the two revealed the likely issue: my implementation used `path.join` to construct the `cwd` (current working directory) for the glob, whereas the older, successful implementation used `path.resolve`.

**The Fix:**
- Changed from `path.join(root, "src")` to `path.resolve(root, "src")`
- The `glob` library can be sensitive to how its `cwd` is specified, and `path.resolve` provides a more robust, absolute path

**Result:** Using `path.resolve` for the `cwd` in the glob search immediately fixed the pre-scan, which now correctly identifies all directive-containing files on startup.

## Attempt 3: Adding Caching and Performance Optimizations

With the basic pre-scan working, the next step was to optimize performance and add proper caching to avoid redundant file reads and directive checks.

**Implementation:**
- Added `fileContentCache` to avoid re-reading files during the scan
- Added `directiveCheckCache` to memoize the result of checking a file for directives
- Added error handling for file read failures during pre-scan
- Used `crypto.randomUUID()` for unique key generation

**Result:** The implementation was successful. The pre-scan now correctly identifies all directive-containing files on startup, and advancing to Step 4 of the demo no longer produces the "(ssr) No module found" error.

## Final Solution: Pre-Scan with Combined Entry Points

The final implementation combines the original entry points with pre-scanned directive files:

1. **Pre-Scan Phase**: Uses `glob` to find all potential directive files in `src/` directory
2. **Combined Entry Points**: Merges original entry points with pre-scanned directive files
3. **Caching**: Avoids redundant file reads and directive checks
4. **Error Handling**: Gracefully handles file read errors during pre-scan

**Key Technical Details:**
- Uses `path.resolve` for robust absolute path handling
- Scans for `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.mdx` files
- Caches directive check results to improve performance
- Gracefully handles file read errors during pre-scan

## Status

✅ **Implemented and tested** - Fixes the stale directive map issue that was causing SSR failures when new client components were introduced.

## Current Implementation Status

**Files Modified:**
- `sdk/src/vite/runDirectivesScan.mts` - Added `findDirectiveRoots` function with glob pre-scan
- `sdk/package.json` - Added `glob` and `@types/glob` dependencies
- `playground/missing-link-directive-scan/` - Created playground example

**Key Changes:**
1. Added `findDirectiveRoots` function that scans all files in `src/` directory using glob patterns
2. Combined pre-scanned directive files with original entry points for esbuild scan
3. Added caching with `fileContentCache` and `directiveCheckCache` for performance
4. Used `path.resolve` instead of `path.join` for robust absolute path handling
5. Created playground example demonstrating the "missing link" scenario

**Playground Example Structure:**
- `ComponentA.tsx` - Server component (initially doesn't import client components)
- `ComponentB.tsx` - Server component that imports `ComponentA` 
- `ComponentC.tsx` - Client component with "use client" directive
- `MissingLinkPage.tsx` - Page that imports `ComponentA`
- `worker.tsx` - Routes `/missing-link` to `MissingLinkPage`

**Test Scenario:**
1. Start dev server - works fine initially
2. Visit `/missing-link` - renders `ComponentA` (server component)
3. Modify `ComponentA.tsx` to uncomment `<ComponentB />` import
4. Refresh page - should now show `ComponentB` and `ComponentC` without SSR errors

## Next Steps

- [x] Create playground example that reproduces the "missing link" scenario
- [ ] Add end-to-end tests to verify the fix works correctly
- [ ] Document the solution in architecture docs
- [ ] Test the playground example to ensure it reproduces the issue correctly
