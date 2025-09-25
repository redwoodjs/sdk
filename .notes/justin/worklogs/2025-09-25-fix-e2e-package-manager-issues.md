
# E2E Test Failures with npm and Yarn

**Date**: 2025-09-25

## Problem

The end-to-end (E2E) tests are failing on CI when run with `npm` and `yarn`. The failures seem to be related to dependency resolution, particularly with canary versions of React, and issues locating the packed `rwsdk` tarball. The goal is to make the E2E tests pass reliably across `pnpm`, `npm`, and `yarn`.

## Investigation and Solution

### Peer Dependency Conflicts (`npm` and `yarn`)

The initial investigation into the CI logs for `npm` revealed `ERESOLVE` errors in the `shadcn` and `chakra-ui` playgrounds. These errors occurred because some dependencies (`react-hook-form`, `@chakra-ui/react`) have a peer dependency on a stable version of React (e.g., `^19.0.0`), but the playgrounds use a canary version (`19.2.0-canary-...`). `npm` and `yarn` are stricter than `pnpm` and do not resolve a stable version range against a pre-release version.

The solution was to enforce the correct React version for each package manager:

1.  **For `npm`**: An `overrides` block was added to the `package.json` of both `playground/shadcn` and `playground/chakra-ui`. This tells `npm` to ignore the peer dependency mismatch and use the specified canary version of `react` and `react-dom`.
2.  **For `yarn`**: A `resolutions` block (the Yarn equivalent of `overrides`) was added to the same `package.json` files to achieve the same result.

Additionally, the Yarn test run revealed that `@chakra-ui/react` requires `@emotion/react` as a peer dependency, which was not explicitly listed in the `chakra-ui` playground's `package.json`. This was added as a direct dependency to resolve the issue.

### `ENOENT` Tarball Error (`npm` and `yarn`)

Several playgrounds were failing with an `ENOENT: no such file or directory` error, unable to find the `rwsdk` tarball. The investigation traced this back to the E2E test setup script (`sdk/src/lib/e2e/environment.mts`).

The script was packing the `rwsdk` and then adding it as a `file:` dependency in the temporary playground's `package.json` using an **absolute path**. This works locally but fails in CI because the test runner copies the playground to a temporary directory (`/tmp/...`), while the absolute path still points to the original location in the build directory (`/home/runner/...`).

An initial attempt to use a relative path proved to be fragile.

The more robust and definitive solution was to modify the test setup script to:
1.  Create the `rwsdk` tarball.
2.  Copy the tarball **directly into** the root of each temporary playground project.
3.  Update the playground's `package.json` to point to the local tarball with a simple file path (e.g., `file:rwsdk-1.0.0-alpha.9.tgz`).

This makes each test environment fully self-contained and removes any reliance on external file paths, ensuring the dependency can be found reliably by any package manager.
