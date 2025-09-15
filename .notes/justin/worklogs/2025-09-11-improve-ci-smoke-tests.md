# Improving CI Smoke Tests with Tarball-based Installation

**Date:** 2025-09-11

## Problem

The current smoke tests in our CI pipeline run against different package managers, but they rely on a "synced" version of the SDK. This approach might mask issues that would only appear in a real-world scenario where the SDK is installed as a package from a registry. The monorepo setup and `pnpm` workspaces could be hiding potential problems related to packaging and dependency resolution.

## Plan

The goal is to make the smoke tests more realistic by simulating a true package installation.

1.  **Create a tarball:** Before running the smoke tests, build the SDK and create a tarball using `npm pack`.
2.  **Isolate the test environment:** For each starter project, create a temporary, isolated directory.
3.  **Install from tarball:** Instead of using the local SDK source code, modify the starter's `package.json` to point the SDK dependency to the newly created tarball file. Then, run the installation using the package manager specified in the CI matrix (`pnpm`, `npm`, `yarn`).
4.  **Run smoke tests:** Execute the smoke tests against this isolated environment.
5.  **Integrate into CI:** This logic will be encapsulated in a new script, which will then be called from the `.github/workflows/smoke-test-starters.yml` workflow. This will replace the current method of running smoke tests.

This process mirrors the one used in the `sdk/scripts/release.sh` script, which provides a good reference.
