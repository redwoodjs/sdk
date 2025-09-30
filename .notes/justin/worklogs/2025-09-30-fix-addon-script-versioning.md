
# Work Log: Fix Addon Script Versioning

**Date**: 2025-09-30

## Problem

Users reported that the `npx rwsdk addon <addon-name>` command was failing with a "Not Found" error. The failure was inconsistent, affecting some users but not others.

The investigation pointed to an issue with how the script constructs the download URL for addon artifacts from GitHub releases. The script expected the `rwsdk` version in the user's `package.json` to be prefixed with a `v` (e.g., `v1.0.0-beta.0`), but it failed when the prefix was absent (e.g., `1.0.0-beta.0`).

## Investigation

The inconsistency arose from two places:

1.  **Release Artifacts**: The `.github/workflows/release-artifacts.yml` workflow used the git tag (which includes a `v`) directly to set the `dependencies.rwsdk` version in the `package.json` files for the starter kit and addons.
2.  **User Setup**:
    *   Users who created a new project from the starter kit had the `v` prefix in their `package.json`, so the addon script worked correctly.
    *   Users who manually installed or updated `rwsdk` in an existing project often specified the version without the `v`, which is standard practice for package managers. This caused the script to generate an incorrect URL.

## Solution

Two changes were made to address the issue:

1.  **Make the Addon Script Resilient**: The script at `sdk/src/scripts/addon.mts` was updated to programmatically add the `v` prefix to the version string if it is missing. This ensures the script can handle both version formats.

2.  **Standardize Release Artifacts**: The `release-artifacts.yml` workflow was modified to remove the `v` prefix from the version tag before writing it to the `package.json` files. This change standardizes the version format in all distributed artifacts, preventing the root cause of the inconsistency.

---

### PR Description

```markdown
# fix(cli): Normalize version string in addon script and release artifacts

## Problem

The `rwsdk addon` command failed with a "Not Found" error for users whose `package.json` listed the `rwsdk` dependency without a `v` prefix (e.g., `"1.0.0-beta.0"`). The script was constructing an incorrect download URL for addon artifacts from GitHub releases because it expected the version to match the `v`-prefixed git tag.

### Why wasn't this an issue for all users?

The problem depended on how a user's project was set up:

-   **New Projects**: Users who created a project using the official starter kit had a `package.json` with the `v` prefix included in the `rwsdk` version. This is because the release workflow used the git tag (e.g., `v1.0.0-beta.0`) to populate the version field. For these users, the script worked as expected.
-   **Existing Projects**: Users who manually added or updated the `rwsdk` dependency in an existing project typically specified the version without the `v`, which is common practice. In this case, the addon script would fail.

## Solution

This change addresses the issue in two ways:

1.  **Addon Script**: The `addon.mts` script is now more resilient. It checks if the `rwsdk` version from `package.json` starts with a digit and, if so, prepends a `v`. This ensures the correct download URL is always generated.
2.  **Release Workflow**: The `release-artifacts.yml` workflow is updated to remove the `v` prefix from the git tag before setting the `rwsdk` version in the `package.json` files for the starter kit and all addons. This standardizes the version format across all distributed code, resolving the root inconsistency.
```
