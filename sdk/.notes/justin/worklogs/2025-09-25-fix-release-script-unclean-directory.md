# Work Log: Finalizing the Release Script Fix

**Date:** 2025-09-25

## Problem

The release script has been consistently failing for pre-releases. The failure occurs during the final `git pull --rebase` step, which aborts due to an "unclean working directory" or "unstaged changes".

The root cause was traced to a special, flawed logic path for pre-releases:

1.  The script correctly skipped updating dependencies in starter projects for pre-releases.
2.  However, a subsequent `pnpm install` would correctly update the root `pnpm-lock.yaml` to reflect the new pre-release version from `sdk/package.json`.
3.  The script's final commit logic for pre-releases had a critical bug: it would amend the release commit **without** staging the modified `pnpm-lock.yaml` file.
4.  This left the working directory dirty, guaranteeing that the final `git pull --rebase` would fail, but only after the package had already been successfully published to npm, resulting in a "half-released" state.

## Solution

A multi-layered solution will be implemented to fix the root cause and make the script more robust against future issues.

1.  **Unify Release Logic:** The special handling for pre-releases will be removed. All non-`test` releases (including pre-releases) will now follow the same, single logic path:
    *   Update dependencies across the entire monorepo (starters, playgrounds, etc.).
    *   Stage **all** resulting changes to `package.json` and `pnpm-lock.yaml` files.
    *   Amend the initial release commit with these changes.
    This ensures that the working directory is always clean after the commit stage.

2.  **Add a Safety Net:** As a "blunt hammer" approach to guarantee reliability, a new step will be added immediately before the final `git pull --rebase`. This step will:
    *   Check for any remaining unstaged changes in the working directory.
    *   If changes are found, print them to the CI logs as a warning for future debugging.
    *   Forcefully discard any and all unstaged changes.
    This provides a final guarantee that the working directory is clean, preventing the rebase from failing.
