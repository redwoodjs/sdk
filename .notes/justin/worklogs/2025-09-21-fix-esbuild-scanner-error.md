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

## PR Description

### Description

This PR fixes a crash in the directive scanner that occurred after a dependency update.

#### Context

The framework includes a custom scanner that uses `esbuild` to find `"use client"` and `"use server"` directives. To keep the scanning process consistent with Vite's behavior and to avoid introducing an extra dependency, this scanner is designed to use the same `esbuild` version that Vite itself uses.

#### Problem

A recent update to `vite` (from `7.1.5` to `7.1.6`) brought in a newer version of `esbuild` (from `^0.23.0` to `^0.24.0`) which contains a breaking change. The new `esbuild` version requires an `outdir` to be specified when bundling multiple entry points, even if the build is not configured to write files to disk (`write: false`). Our scanner uses multiple entry points, and this change caused it to fail.

#### Solution

The `esbuild` configuration for the scanner is updated to include an `outdir`. A path to a temporary system directory is used for this purpose. Because the scanner is still configured with `write: false`, no files are actually written to the disk. This change satisfies the new requirement from `esbuild` and resolves the error.
