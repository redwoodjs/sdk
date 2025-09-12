# Smoke Testing Strategy for Package Manager Compatibility

This document details the strategy for our smoke tests, which are designed to ensure the SDK functions correctly across various package managers and environments. It explains why we use a tarball-based testing approach instead of more common monorepo linking techniques.

## The Challenge: Simulating a Real-World Installation

The primary goal of our smoke tests is to validate the end-user experience of installing and using the SDK. A user consumes the SDK as a versioned package from a registry like npm. Testing directly within our monorepo, however, can mask critical issues related to packaging, dependency resolution, and peer dependency conflicts.

A key example of this challenge is managing peer dependency updates. Consider the following scenario:

1.  **Dependency Update:** We decide to support a new major version of Vite. We update the SDK's `peerDependencies` in its `package.json` to allow both the old and new versions (e.g., `"vite": "^6.0.0 || ^7.0.0"`).
2.  **Starter Update:** Simultaneously, we update the Vite version in our `minimal` starter's `package.json` to the new version (`"vite": "^7.0.0"`). The starter's dependency on our SDK still points to the last *published* version, not the new code we've just changed.
3.  **The Conflict:** When running tests in a naive setup, the package manager would try to install the starter's dependencies. It would see a request for Vite `^7.0.0` from the starter, but the *old, installed version* of the SDK it's trying to use only has a peer dependency requirement for Vite `^6.0.0`. This creates a peer dependency conflict, and the installation fails.

This scenario highlights that testing against local source code is insufficient. We must test against the SDK as it would be packaged and published.

## Our Solution: Tarball-Based Testing

To accurately replicate a user's installation process, our CI pipeline implements the following steps for each smoke test run:

1.  **Build & Pack:** The latest version of the SDK source code is built.
2.  **Create Tarball:** Immediately after the build, `npm pack` is used to create a `.tgz` tarball. This file is an exact replica of what would be published to the npm registry.
3.  **Isolate Starter:** A fresh copy of the starter project is created in a temporary, isolated directory.
4.  **Install from Tarball:** The starter's `package.json` is not modified. Instead, the package manager (`pnpm`, `npm`, or `yarn`) is instructed to install the SDK from the local tarball file. This overrides the version specified in the `package.json` and installs the freshly built and packed SDK.
5.  **Run Tests:** The smoke tests are then executed against this isolated, cleanly installed project.

This process ensures that every test run validates the entire workflow, from packaging to installation and execution, catching the exact kind of peer dependency issues described above.

## Design Decisions & Alternatives (FAQ)

### Q: Why not use monorepo workspace linking (e.g., `workspace:*`) for the starters?

Using workspace protocols is a common and effective strategy for managing internal dependencies within a monorepo. However, it is not suitable for our starters for two main reasons:

1.  **Starter Portability:** Our starter projects are designed to be standalone templates that users can copy directly from the repository to start a new project. If the SDK dependency was specified as `workspace:*`, it would be a broken reference outside of our monorepo context. Users would be forced to manually edit the `package.json` to a valid version number. By using a standard version number, the starters remain portable and ready-to-use.

2.  **The Need for Isolation in Tests:** Even if we used workspace links for local development, we would still need to replace them during CI to test the *packaged* version of the SDK. The goal is to simulate a real installation, not to test against the local source code via a symlink. Therefore, we would end up needing a tarball-based replacement mechanism for CI anyway. Our current approach standardizes on the tarball method for all testing, which is simpler and more accurately reflects the end goal.
