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


### Final Attempt: Robust SDK Update on Cache Hit

My previous attempt to fix the `ERR_MODULE_NOT_FOUND` error by including the SDK's `dist` hash in the cache key was incorrect. This went against the desired developer workflow, which requires the cache to remain valid during local SDK development.

The root cause of the module not found error was the use of `pnpm add` to update the SDK in a cached `node_modules` directory. This command appeared to be creating an inconsistent state.

The correct solution is to revert to the desired caching strategy and use a more idiomatic package manager command:

1.  **Cache Key:** The cache key is based **only** on the project's dependency lockfiles. It does not include a hash of the SDK's source.
2.  **Cache Hit Logic:** On a cache hit, the process is now:
    a.  Restore the `node_modules` directory from the cache using the appropriate platform-specific command (`cp -al` or `copy`).
    b.  Run a standard `pnpm install`. Because the `package.json` has been updated to point to the new, locally-packed SDK tarball, `pnpm` will see that only this one dependency needs to be updated. It performs a fast, minimal installation of just the SDK without disturbing the rest of the `node_modules` tree.

This approach is both correct and efficient. It preserves the cache across SDK changes and uses the package manager's standard mechanism for updating a single dependency, which avoids corrupting the installation.

### PR Description

#### PR Title

fix(e2e): Resolve non-Windows CI failures by restoring platform-specific caching

#### PR Description

This PR resolves E2E test failures on non-Windows CI environments that were introduced by recent changes for Windows compatibility.

##### Problem

After switching from `cp -al` to `fs-extra/copy` for cross-platform support, tests on Linux and macOS began failing with two main errors:
*   `ENOTEMPTY: directory not empty, rmdir ...`
*   `Cannot copy '...' to a subdirectory of itself`

These errors occurred because `fs-extra`'s `copy` function dereferences symlinks by default, leading to infinite recursion when processing `pnpm`'s `node_modules` structure. Subsequent attempts to fix this by altering the installation logic on a cache hit resulted in `ERR_MODULE_NOT_FOUND` errors from Vite.

##### Solution

The solution restores the desired developer workflow where the dependency cache remains valid across local SDK changes, while fixing the underlying installation issues.

1.  **Platform-Specific Cache Copying:** The logic for copying the `node_modules` directory is now platform-aware:
    *   **On Unix-like systems (Linux/macOS):** The implementation reverts to using `cp -al`. This creates a fast, hardlink-based copy that correctly preserves `pnpm`'s symlink structure.
    *   **On Windows:** The implementation continues to use `fs-extra/copy`.

2.  **Robust SDK Update on Cache Hit:** On a cache hit, after restoring `node_modules`, the harness now runs a standard `pnpm install` (or equivalent). This allows the package manager to perform a fast, minimal update of just the local SDK package—which has been updated in `package.json` to point to a new tarball—without disturbing the rest of the cached dependencies. This is more reliable than the previous `pnpm add` approach and resolves the Vite module errors.
