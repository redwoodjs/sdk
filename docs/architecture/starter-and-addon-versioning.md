# Starter and Addon Versioning and Release Strategy

This document outlines the versioning, testing, and release strategy for the RedwoodSDK `starter` project and official `addons`. The primary goal is to ensure that the starter and addons are always compatible with the version of the SDK they are released with, providing a stable experience for developers.

## The Challenge

A key challenge is managing the dependency between the `starter`/`addons` and the `rwsdk` package. During development within the monorepo, we need them to use the local, in-development version of the SDK. However, when a user downloads a starter release or an addon, it must depend on a specific, published version of `rwsdk` to guarantee compatibility and prevent breakages.

## The Solution: A Unified, Multi-Stage Process

We have implemented a unified strategy that handles the entire lifecycle, from local development to CI validation and final release.

### 1. Development: `workspace:*` Protocol

For local development, we use pnpm's `workspace:*` protocol. The `starter` project's `package.json` is checked into source control with `"rwsdk": "workspace:*"`.

This tells pnpm to create a symlink to the local `sdk` package within the monorepo. Any changes made to the SDK source code are immediately reflected in the `starter` project, enabling rapid development and testing without needing to publish intermediate versions.

### 2. Continuous Integration: Unified Code Quality Checks

To ensure that changes to the SDK don't break the starter or addons (and vice-versa), our CI process runs unified checks.

-   **`code-quality.yml` Workflow**: This GitHub Actions workflow is triggered on pull requests and pushes that affect the `sdk/`, `starter/`, or `addons/` directories.
-   **Comprehensive Type-Checking**: The workflow runs `tsc` against the SDK, the starter, and each official addon. Because the `starter` and `addons` use the `workspace:*` dependency, these checks validate the integration against the very latest SDK code in the branch, catching type errors and mismatches before they are merged.

### 3. Release: A Two-Stage, Tag-Triggered Process

The release process is designed to automatically update the `rwsdk` dependency to a fixed version number before packaging the starter.

-   **Stage 1: The Main SDK Release (`release.yml`)**
    1.  A developer manually triggers the `release.yml` workflow.
    2.  This workflow runs the `sdk/scripts/release.sh` script, which handles version bumping (e.g., `1.2.3`), publishing the `rwsdk` package to npm, and pushing a corresponding git tag (e.g., `v1.2.3`) to the repository.

-   **Stage 2: The Starter Release (`release-starters.yml`)**
    1.  The push of the new git tag automatically triggers the `release-starters.yml` workflow.
    2.  This workflow checks out the code at that specific tag.
    3.  It **updates `starter/package.json`**, replacing `"rwsdk": "workspace:*"` with the exact version from the tag (e.g., `"rwsdk": "1.2.3"`).
    4.  It then packages the `starter` directory into `.tar.gz` and `.zip` archives.
    5.  Finally, it attaches these archives to the GitHub Release corresponding to the tag.

### 4. Addon Distribution: Version-Locked Scaffolding

Addons follow the same principle of being version-locked but are distributed as source code rather than packaged archives.

-   **`npx rwsdk addon <name>`**: When a user runs this command, the script determines the user's currently installed `rwsdk` version.
-   **Version-Specific Download**: It uses a tool called `tiged` (a fork of `degit`) to download the source code of the addon directly from the git tag that matches the user's SDK version (e.g., from the `v1.2.3` tag).

This ensures that the addon code a user scaffolds into their project is the exact version that was tested and released with their version of the SDK, preventing compatibility issues.
