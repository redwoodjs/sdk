# SDK, Starter, and Addon Release Process

This document outlines the comprehensive versioning, testing, and release strategy for the RedwoodSDK ecosystem, including the core `rwsdk` package, the `starter` project, and official `addons`. The goal is a cohesive and automated process that ensures all distributed artifacts are version-locked and stable.

## The Challenge

Managing dependencies and ensuring compatibility between a core framework, a starter template, and various addons is complex. We need a system that:
1.  Uses the latest local source code for seamless development within the monorepo.
2.  Guarantees that downloadable starters and addons use a specific, published version of the SDK.
3.  Automates as much of the release process as possible to ensure consistency and reduce manual error.

## The Solution: A Three-Stage Automated Release

The entire process is orchestrated through a series of GitHub Actions workflows, creating a clear, multi-stage pipeline from development to consumption.

### Stage 1: Local Development & CI

-   **`workspace:*` Protocol**: For local development, all internal dependencies within the monorepo (e.g., the `starter` project's dependency on `rwsdk`) use pnpm's `workspace:*` protocol. This symlinks the packages, ensuring that any changes to the SDK are immediately available to the starter and addons.
-   **Unified CI (`code-quality.yml`)**: On every push and pull request, a unified CI workflow runs type-checking across the SDK, the starter, and all addons simultaneously. This catches integration issues early by validating them against the very latest source code in the branch.

### Stage 2: The SDK Release (`release.yml`)

This is the primary, manually-triggered event that kicks off a release.

1.  **Trigger**: A core contributor triggers the `release.yml` workflow via the GitHub Actions UI, specifying the version type (e.g., `patch`, `minor`, `explicit`).
2.  **Version Calculation**: The `sdk/scripts/release.sh` script calculates the new version number (or uses the one provided) and updates `sdk/package.json`.
3.  **Commit**: A `chore(release): <version>` commit is created with this change.
4.  **Build**: The SDK is built with `NODE_ENV=production`.
5.  **Pack**: The built SDK is packed into a `.tgz` tarball.
6.  **Smoke Test**: A comprehensive smoke test is performed against the packed tarball. A temporary project is created from the `starter`, and the tarball is installed and tested to ensure the packaged code works as expected.
7.  **Publish to npm**: If the smoke tests pass, the `.tgz` tarball is published to the npm registry.
8.  **Tag and Push**: The release commit is tagged (e.g., `v1.2.3`), and the commit and tag are pushed to the `main` branch.

### Stage 3: Artifact Release (`release-artifacts.yml`)

The push of the new git tag from Stage 2 automatically triggers this final stage.

1.  **Trigger**: The `release-artifacts.yml` workflow is triggered by the new `v*.*.*` tag.
2.  **Checkout at Tag**: The workflow checks out the repository at the exact commit associated with the tag.
3.  **Update Starter Version**: It modifies the `starter/package.json`, replacing `"rwsdk": "workspace:*"` with the exact release version (e.g., `"rwsdk": "1.2.3"`).
4.  **Package Artifacts**: The workflow creates `.tar.gz` and `.zip` archives for:
    -   The single `starter` project.
    -   *Each* official addon located in the `addons/` directory.
5.  **Upload to Release**: All generated tarballs (for the starter and all addons) are uploaded to the GitHub Release corresponding to the tag.

### Consumption: How Users Get the Code

-   **`create-rwsdk`**: When a user runs `npx create-rwsdk my-app`, the CLI queries GitHub for the latest release, downloads the correct `starter-<version>.tar.gz` artifact, and decompresses it.
-   **`rwsdk addon`**: When a user with `rwsdk` version `1.2.3` installed runs `npx rwsdk addon passkey`, the script downloads the `passkey-v1.2.3.tar.gz` artifact from the corresponding GitHub Release and decompresses it into their project.

This end-to-end process ensures a high degree of automation and guarantees that all distributed code—whether a new project or an added feature—is version-locked and compatible.
