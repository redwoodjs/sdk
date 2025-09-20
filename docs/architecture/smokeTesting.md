# End-to-End Testing

This document details the end-to-end testing strategy for the SDK, which is designed to ensure it functions correctly across various package managers and environments. It covers two primary forms of testing: **Starter Smoke Tests** and **Playground E2E Tests**.

## The Challenge: Simulating Real-World Usage

The primary goal of our end-to-end tests is to validate the user experience. However, "user experience" differs depending on the context.

1.  **For a new user starting a project,** the experience involves installing a published package from a registry like npm. Testing directly within our monorepo using workspace links can mask critical issues related to packaging, dependency resolution, and peer dependency conflicts.
2.  **For the core team developing the SDK,** the experience involves testing changes against a variety of application setups to check for feature correctness and regressions.

Our testing strategy must address both of these contexts effectively.

## Our Solution: A Two-Tiered Approach

To meet these distinct needs, we employ a two-tiered testing approach that uses different installation and linking strategies.

### Tier 1: Starter Smoke Tests (Tarball-Based)

To accurately replicate a new user's installation process, our CI pipeline for the starter templates implements a tarball-based workflow.

1.  **Build & Pack:** The latest version of the SDK source code is built.
2.  **Create Tarball:** Immediately after the build, `npm pack` is used to create a `.tgz` tarball. This file is an exact replica of what would be published to the npm registry.
3.  **Isolate Starter:** A fresh copy of the starter project is created in a temporary, isolated directory.
4.  **Install from Tarball:** The package manager is instructed to install the SDK from the local tarball file. This overrides the version specified in the starter's `package.json` and installs the freshly built SDK.
5.  **Run Tests:** The smoke tests are then executed against this isolated, cleanly installed project.

This process ensures that every test run validates the entire workflow from packaging to installation, catching potential peer dependency and packaging issues before they reach users.

### Tier 2: Playground E2E Tests (Tarball-Based)

For internal feature and regression testing, we use a `playground` directory within the monorepo. Each subdirectory is a separate, isolated test project designed to test a specific scenario.

Crucially, like the starter smoke tests, the playground tests also follow the **tarball-based testing** workflow. This ensures that every test, whether for a starter or a specific feature in the playground, runs in a completely isolated environment that accurately simulates a user's installation.

The playground tests are designed to:
-   Verify the correctness of specific SDK features.
-   Prevent regressions by adding a dedicated test case for every fixed bug.
-   Test complex interactions between different parts of the SDK in a realistic application environment.

## Design Decisions & Alternatives (FAQ)

### Q: Why not use workspace linking for the starters?

Using `workspace:*` is a common strategy for monorepos, but it is not suitable for our starters for two reasons:

1.  **Starter Portability:** Our starters are designed to be standalone templates that users can copy directly. A `workspace:*` dependency would be a broken reference outside our monorepo, forcing users to manually edit the `package.json`. By using a standard version number, the starters remain portable.
2.  **Need for Installation Simulation:** The primary goal of starter smoke tests is to simulate a real installation from a package registry. Using a workspace link would bypass this crucial validation step.

### Q: Why use workspace linking for the playground?

Playground projects use `workspace:*` in their source `package.json` files purely for development convenience. It simplifies dependency management within the monorepo and avoids the need for constant version bumping during development.

However, this link is **only for the source code**. During test execution, the test runner overrides this by installing the SDK from a freshly packed tarball, ensuring that the test validates the packaged code, not the local source via a symlink. This maintains a consistent and realistic testing methodology across all end-to-end tests.

## Test Execution

### Running Tests Locally

To run smoke tests for a starter project, run this from within the `sdk/` dir:
```sh
pnpm smoke-test --path=../starters/standard
```

To run the playground E2E tests:
```sh
# (This command will be defined as part of the implementation)
pnpm test:e2e
```

### CI Integration

All tests run automatically in GitHub Actions on pushes to the main branch and pull requests. The tests are run across a matrix of operating systems (Linux, Windows) and package managers (pnpm, npm, yarn) to ensure broad compatibility.
