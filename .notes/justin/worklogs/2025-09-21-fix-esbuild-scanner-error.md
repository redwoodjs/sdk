# 2025-09-21: Fix esbuild scanner error after dependency updates

## Problem

After updating dependencies, particularly Vite, our custom directive scanner which uses esbuild is failing with the error: `error: Must use "outdir" when there are multiple input files`. This is happening even though we have `write: false` in our esbuild configuration, which should prevent esbuild from writing to the filesystem and thus not require an `outdir`.

This seems to be caused by a dependency update to Vite, which in turn updated its internal esbuild version.

## Plan

1.  Investigate recent changes in `esbuild` to see if there's a breaking change related to `bundle`, `entryPoints`, `write: false`, and `outdir`.
2.  Examine how we're using `esbuild` in `runDirectivesScan.mts` and if our usage is still valid.
3.  Apply a fix to the scanner.

## Investigation: esbuild version change

Checked Vite's dependencies:
- Vite `7.1.5` depends on `esbuild: ^0.23.0`.
- Vite `7.1.6` depends on `esbuild: ^0.24.0`.

This confirms an upgrade of `esbuild` from `0.23.x` to `0.24.x`.

A search of the `esbuild` changelog for version `0.24.0` revealed a breaking change:

> The `write: false` setting is now an error when used with multiple entry points and `bundle: true` unless you are also using `outdir`. Previously this combination of settings would silently throw away all but one of the output files. This was a bug. The fix is to use `outdir` when you have multiple entry points.

This is exactly the situation in our scanner. It uses multiple entry points with `bundle: true` and `write: false`.

## Solution

The fix is to provide an `outdir` to the `esbuild.build` call in `runDirectivesScan.mts`. Since `write: false` is set, no files will actually be written to disk. The `outdir` is used by esbuild to structure the in-memory output. A temporary directory will be used.

I will add an `outdir` to the esbuild configuration.


## Follow-up Issue

After applying the fix, a new error appeared:

```
error: The entry point "/Users/justin/rw/worktrees/sdk_renovate-starter-peer-deps/playground/hello-world/virtual:cloudflare/worker-entry" cannot be marked as external
```

This suggests that the scanner is now encountering a virtual module (`virtual:cloudflare/worker-entry`) and trying to mark it as external, but esbuild doesn't allow virtual modules to be external. This might be related to the Cloudflare Vite plugin update in the dependency changes.

Need to investigate how to handle virtual modules in the scanner's esbuild configuration.

## Additional Fix

The issue is that the scanner is receiving virtual modules (like `virtual:cloudflare/worker-entry`) as entry points from the Vite configuration. Virtual modules cannot be resolved to absolute file paths and cannot be marked as external in esbuild.

The solution is to filter out virtual modules from the entry points before passing them to esbuild, since virtual modules don't contain actual source code that can be scanned for directives anyway.

Applied fix: Added a filter to remove any entry that contains `virtual:` before processing the entries for the esbuild scan.

## PR Description

### Description

This PR fixes crashes in the directive scanner that occurred after dependency updates.

#### Context

The framework includes a custom scanner that uses `esbuild` to find `"use client"` and `"use server"` directives. To keep the scanning process consistent with Vite's behavior and to avoid introducing an extra dependency, this scanner is designed to use the same `esbuild` version that Vite itself uses.

#### Problem

A recent update to `vite` (from `7.1.5` to `7.1.6`) brought in a newer version of `esbuild` (from `^0.23.0` to `^0.24.0`) which contains breaking changes that affected the scanner in two ways:

1. The new `esbuild` version requires an `outdir` to be specified when bundling multiple entry points, even if the build is not configured to write files to disk (`write: false`). Our scanner uses multiple entry points, causing it to fail with "Must use 'outdir' when there are multiple input files".

2. The scanner began receiving virtual modules (like `virtual:cloudflare/worker-entry`) as entry points, which cannot be marked as external in esbuild, causing "cannot be marked as external" errors.

#### Solution

Two fixes were applied to the scanner configuration:

1. **Added `outdir` parameter**: The `esbuild` configuration now includes a path to the project's intermediate builds directory. Because the scanner is still configured with `write: false`, no files are actually written to disk. This satisfies the new requirement from `esbuild` while avoiding potential collisions between multiple projects.

2. **Filter virtual modules**: Entry points containing `virtual:` are now filtered out before being passed to esbuild, since virtual modules don't contain actual source code that can be scanned for directives.
