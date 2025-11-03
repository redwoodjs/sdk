# 2025-11-03: Fix Non-Windows CI E2E Failures

## Problem

After a series of fixes to get the E2E tests running on Windows, we're now facing failures in the CI environment for non-Windows platforms (Linux, macOS). The errors indicate issues with file system operations on `pnpm`'s symlinked `node_modules` directory.

The two main errors are:
- `ENOTEMPTY: directory not empty, rmdir ...`
- `Cannot copy '...' to a subdirectory of itself`

This is likely because the switch from the Unix-specific `cp -al` command to the cross-platform `fs-extra/copy` function does not correctly handle the symlink structure that `pnpm` uses.

### Investigation

The `fs-extra` `copy` function appears to be dereferencing symlinks by default. When it encounters a symlink pointing to a parent directory (a common pattern in `pnpm`'s `node_modules`), it tries to copy the parent directory into itself, leading to an infinite loop and the "subdirectory of itself" error. The `ENOTEMPTY` error is a downstream effect, where the test cleanup process fails to delete the corrupted directory structure.

### Plan

The most direct solution is to restore the original, platform-specific behavior for caching the `node_modules` directory.

1.  **Modify `installDependencies` in `sdk/sdk/src/lib/e2e/environment.mts`**
2.  **Conditional Caching Logic:**
    -   **On Windows:** Continue using the current `fs-extra/copy` method.
    -   **On non-Windows platforms (Linux/macOS):** Revert to using the `cp -al` command. This command creates a fast, hardlink-based copy of the directory that correctly preserves the symlink structure without causing recursion.

This approach combines the Windows compatibility we need with the performance and correctness of the original implementation for Unix-like systems.

### Implementation

I have modified `sdk/sdk/src/lib/e2e/environment.mts` to re-introduce platform-specific logic for handling the `node_modules` cache.

-   **Unix (Linux/macOS):** The caching process now uses `cp -al` to create a hard-linked copy of the `node_modules` directory. This is fast and correctly preserves the symlink structure created by `pnpm`.
-   **Windows:** The existing logic, which uses `fs-extra`'s `copy` function, remains in place to ensure Windows compatibility.

This change should resolve the `ENOTEMPTY` and "Cannot copy to a subdirectory" errors on non-Windows CI runners.

### Attempt 2: Simplify Caching Logic

The previous fix introduced a new error: `ERR_MODULE_NOT_FOUND` from Vite when starting the dev server. This suggests that the two-step installation process (restoring from cache, then installing the SDK tarball on top) was creating an inconsistent or corrupt `node_modules` directory.

To fix this, I have simplified and robustified the caching strategy:

1.  **Cache Key Enhancement:** The cache key is now a combination of the project's dependency hash and a hash of the SDK's `dist` directory. This ensures that any change to the SDK source code will correctly invalidate the cache.
2.  **Simplified Cache Restore:** On a cache hit, the test harness now restores the `node_modules` directory from the cache and does nothing else. The installation step is skipped entirely. Because the SDK hash is part of the key, the cached `node_modules` is guaranteed to contain the correct version of the SDK.
3.  **Clean Installation on Cache Miss:** On a cache miss, the harness performs a single, clean `pnpm install`. This command installs both the project's third-party dependencies and the local SDK tarball in one atomic operation, creating a consistent state. The resulting `node_modules` is then saved to the cache.

This new approach eliminates the complex and error-prone two-step installation, which should resolve the module resolution failures.

### PR Description

#### PR Title

fix(e2e): Resolve non-Windows CI failures by restoring platform-specific caching

#### PR Description

This PR resolves E2E test failures on non-Windows CI environments that were introduced by recent changes for Windows compatibility.

##### Problem

After switching from \`cp -al\` to \`fs-extra/copy\` for cross-platform support, tests on Linux and macOS began failing with two main errors:
*   \`ENOTEMPTY: directory not empty, rmdir ...\`
*   \`Cannot copy '...' to a subdirectory of itself\`

These errors occurred because \`fs-extra\`'s \`copy\` function dereferences symlinks by default. When encountering the symlink structure created by \`pnpm\` in \`node_modules\`, it would attempt to copy directories into themselves, leading to infinite recursion and corrupted state that could not be cleaned up.

##### Solution

The solution involves two main changes to the E2E test harness (\`sdk/sdk/src/lib/e2e/environment.mts\`):

1.  **Platform-Specific Cache Copying:** The logic for copying the \`node_modules\` directory from the cache has been made platform-aware:
    *   **On Unix-like systems (Linux/macOS):** The implementation reverts to using \`cp -al\`. This command creates a fast, hardlink-based copy that correctly preserves \`pnpm\`'s symlink structure.
    *   **On Windows:** The implementation continues to use \`fs-extra/copy\` to maintain compatibility.

2.  **Simplified Caching Strategy:** The caching logic was further refined to be more robust and prevent module resolution errors.
    *   The cache key is now generated from a hash of both the project's dependencies *and* the SDK's \`dist\` directory.
    *   On a cache hit, the harness restores the \`node_modules\` directory and skips the installation step entirely. This ensures a consistent state, as the cached directory is guaranteed to contain the correct version of all dependencies, including the local SDK.

This approach resolves the file system errors on Unix-like systems while preserving the necessary compatibility for the Windows test environment.
