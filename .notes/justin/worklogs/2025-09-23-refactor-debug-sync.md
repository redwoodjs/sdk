## Problem

The current `debug-sync` script relies on creating tarballs and using package managers to install them. This process is complex and unreliable. It frequently modifies the project's lock file, which creates unwanted changes in the user's repository. In watch mode, changes to `package.json` during the sync process can trigger a new, unnecessary sync, leading to loops and instability.

## Proposed Solution

Refactor the sync script to remove the dependency on tarballs and package managers. The approach will be:

1.  Sync the SDK source files directly into a temporary directory within the target project's `node_modules` folder (e.g., `node_modules/.rwsync/rwsdk`).
2.  After syncing, remove the existing `node_modules/rwsdk` directory.
3.  Create a symbolic link from `node_modules/rwsdk` to the temporary sync directory (`node_modules/.rwsync/rwsdk`).

This method should avoid any modifications to `package.json` or lock files, providing a more stable and predictable developer experience.

## Implementation Notes

The initial implementation revealed that simply replacing the `rwsdk` directory broke the nested `node_modules` within it, which contains essential dependencies installed by pnpm. The script was updated to temporarily move this nested `node_modules` directory out of the way before the sync and then move it back into the newly synced directory.

A further issue was discovered where the relative symlinks within the preserved `node_modules` directory were breaking after being moved. To resolve this, the sync strategy was changed:

1.  The script now identifies the monorepo root by locating the `pnpm-workspace.yaml` file.
2.  It creates a project-specific sync directory inside the monorepo root's `node_modules` (e.g., `node_modules/.rwsync_my-project/rwsdk`).
3.  The `rwsdk` package in the target project's `node_modules` is then symlinked to this centralized location.

This approach ensures that the synced package resides at the correct directory level, preserving the integrity of pnpm's relative symlinks.

## Attempt: Hybrid Tarball and Rsync

The symlinking approach, while an improvement, still had edge cases and proved to be brittle. After further iteration, a more robust hybrid strategy was developed:

1.  **Dependency Change (Full Sync)**: When a change in `rwsdk`'s `package.json` dependencies is detected (or on the very first run), the script performs a "full sync." It packs the SDK into a tarball and installs it into a dedicated, isolated, and git-ignored directory within the monorepo's `node_modules` (e.g., `node_modules/.rwsync_my-project`). This leverages the package manager to correctly resolve and install all dependencies in a self-contained way, without modifying the user's project lockfile. The project's `node_modules/rwsdk` is then symlinked to this clean installation.
2.  **Code-Only Change (Fast Sync)**: For all subsequent changes where dependencies are unchanged, the script performs a "fast sync." It uses `rsync` to rapidly copy only the changed source files directly into the isolated `rwsdk` directory.

This hybrid model provides the correctness of a full package manager installation when dependencies change, and the speed of a direct file sync for the common case of iterative code changes.
