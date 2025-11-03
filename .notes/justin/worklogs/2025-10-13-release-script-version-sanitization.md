# Work Log: Release Script Explicit Version Sanitization

**Date:** 2025-10-13

## Problem

The `sdk/scripts/release.sh` script does not handle explicit versions that are prefixed with a `v` (e.g., `v1.2.3`). When a user provides such a version, the script prepends another `v` when creating the git tag, resulting in an incorrect tag like `vv1.2.3`. This can cause issues with release creation and version tracking.

## Plan

1.  **Sanitize Version Input in `release.sh`:** Modify the `release.sh` script to detect if the `--version` argument for an `explicit` release starts with `v`. If it does, strip the prefix before using the version string. This ensures that the version number used for `package.json`, the commit message, and the git tag is always in the correct format (e.g., `1.2.3`).

This approach isolates the fix to the script itself, making it more robust regardless of how it's invoked (e.g., from a GitHub Actions workflow or a local terminal). The GitHub workflow will not require any changes.
