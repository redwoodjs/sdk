# SDK, Starter, and Addon Release Process

This document outlines the comprehensive versioning, testing, and release strategy for the RedwoodSDK ecosystem, including the core `rwsdk` package, the `starter` project, and official `addons`. The goal is a cohesive and automated process that ensures all distributed artifacts are version-locked and stable.

## The Challenge

Managing dependencies and ensuring compatibility between a core framework, a starter template, and various addons is complex. We need a system that:
1.  Uses the latest local source code for seamless development within the monorepo.
2.  Guarantees that downloadable starters and addons use a specific, published version of the SDK.
3.  Automates as much of the release process as possible to ensure consistency and reduce manual error.

## The Solution: A Tiered, Automated Release Strategy

The entire process is orchestrated through a series of GitHub Actions workflows, creating a clear, multi-stage pipeline from development to consumption. The strategy is built on three release tiers: **Stable/Beta**, **Pre-release**, and **Test**.

### Stage 1: Local Development & CI

-   **`workspace:*` Protocol**: For local development, all internal dependencies within the monorepo (e.g., the `starter` project's dependency on `rwsdk`) use pnpm's `workspace:*` protocol. This symlinks the packages, ensuring that any changes to the SDK are immediately available to the starter and addons.
-   **Unified CI (`code-quality.yml`)**: On every push and pull request, a unified CI workflow runs type-checking across the SDK, the starter, and all addons simultaneously. This catches integration issues early by validating them against the very latest source code in the branch.

### Stage 2: The SDK Release (`release.yml`)

This is the primary, manually-triggered event that kicks off a release. It determines the release's *intent* and publishes the package to npm.

1.  **Trigger**: A core contributor triggers the `release.yml` workflow via the GitHub Actions UI, specifying the version type (e.g., `patch`, `minor`, `explicit`, `test`). Test releases can be run from any branch, while others run from `main`.
2.  **Version & npm Tag**: The `sdk/scripts/release.sh` script calculates the new version and determines the correct npm tag:
    -   **Stable & Beta versions** (e.g., `v1.2.3`, `v1.3.0-beta.0`) get the `latest` npm tag.
    -   **Pre-releases** (e.g., `v1.3.0-alpha.0`) get the `pre` npm tag.
    -   **Test releases** (e.g., `v1.3.0-alpha.0-test.12345`) get the `test` npm tag.
3.  **Build & Pack**: The SDK is built and packed into a `.tgz` tarball.
4.  **Smoke Test**: A comprehensive smoke test is performed against the packed tarball to ensure it works correctly in a fresh project.
5.  **Publish to npm**: If tests pass, the tarball is published to npm with the appropriate tag.
6.  **Commit & Git Tag**: A release commit and a git tag (e.g., `v1.2.3`) are created and pushed.
7.  **Create GitHub Release**: A GitHub Release is created from the tag with specific flags based on the version type:
    -   **Stable & Beta versions** get the `--latest` flag, making them the primary release.
    -   **Pre-releases (alphas, etc.) and Test versions** get the `--prerelease` flag, marking them as such on GitHub.

### Stage 3: Artifact Release (`release-artifacts.yml`)

The push of any new git tag automatically triggers this final stage, which prepares the starter and addon artifacts.

1.  **Trigger**: The workflow is triggered by any new `v*.*.*` tag.
2.  **Update Dependencies**: The workflow checks out the repository at the tag and updates the `starter/package.json` and all `addons/*/package.json` files, replacing `"rwsdk": "workspace:*"` with the exact release version (e.g., `"rwsdk": "1.2.3"`).
3.  **Package Artifacts**: The workflow creates `.tar.gz` and `.zip` archives for the `starter` project and each addon.
4.  **Upload to Release**: The generated artifacts are uploaded to the GitHub Release that was created in Stage 2.

### Consumption: How `create-rwsdk` Selects a Version

The `create-rwsdk` CLI is designed to intelligently consume these releases, providing clear pathways for users.

-   **Default (`npx create-rwsdk my-app`)**: The CLI queries GitHub's `/releases/latest` API endpoint. Because our `release.yml` workflow correctly uses the `--latest` flag, this endpoint returns the most recent stable or beta release.
-   **Pre-release (`--pre` flag)**: The CLI queries the `/releases` API to get a list of all releases. It then filters out any release containing `-test.` in its tag name and selects the most recent remaining pre-release. This gives users access to the latest alphas and release candidates without including internal test builds.
-   **Specific Version (`--release` flag)**: The CLI downloads the artifacts for a specific tag (e.g., `v1.3.0-alpha.0-test.12345`), allowing developers to test any version, including test builds.

This end-to-end process ensures a high degree of automation and guarantees that all distributed code—whether a new project or an added feature—is version-locked and compatible, with clear channels for stable, pre-release, and internal testing tracks.
