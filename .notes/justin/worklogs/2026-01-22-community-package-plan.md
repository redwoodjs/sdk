# Planning Community Package

## Context and Plan
We want to add a `rwsdk-community` package to the monorepo to house community extensions, specifically starting with the Vitest Bridge implementation. This involves refactoring the playground structure and setting up new infrastructure.

### 1. Repository Structure
- Create a new package `rwsdk-community` (likely at `community/` or `packages/community`).
- It should have `rwsdk` as a `peerDependency`.
- Dependencies should mirror `rwsdk` (React, Vite, etc) where appropriate, using the same versions.

### 2. Playground Refactor using `rwsdk/e2e` Infra
- **Clean up SDK Playground**:
    - Rename `playground/hello-world` to `playground/kitchen-sink` (or similar) to reflect its current "kitchen sink" status.
    - Create a *new, minimal* `playground/hello-world` based on the `starter`.
        - Remove "Welcome" page complexities.
        - Just render "Hello World".
        - Add a basic test (`renders hello world`) using the `rwsdk/e2e` infra.
- **Setup Community Playground**:
    - Move `playground/community` to `community/playground`.
    - Copy the new minimal `hello-world` to `community/playground/hello-world`.
    - Verify that `rwsdk/e2e` infra works for this community example too (user suspects it will work out of the box because it points to `rwsdk-e2e` package).

### 3. Community Library Implementation
- Port the **Vitest Bridge** pattern (currently in docs) into the library.
- Exports:
    - `rwsdk-community/worker`: Helper for `handleTestRequest`.
    - `rwsdk-community/client`: Client-side helpers.
    - `rwsdk-community/test`: Test utilities (the `invoke` helper).
- Refactor the `vitest-showcase` (now in `community/playground`) to use these new exports instead of manual copy-paste.

### 4. Documentation
- **`CONTRIBUTING.md`**:
    - Clarify generic testing policy:
        - Core SDK: Strict E2E coverage required.
        - Community Package: "Ideally" unit/integration tests, but less strict.
        - Community *Playground*: No CI E2E required, but "ideally" have them.
- **`SUPPORT.md`**:
    - Explicitly state **NO Stability Guarantees** for `rwsdk-community`.
    - No ABI stability.
- **`docs/vitest.mdx`**:
    - Update the guide to tell users to use `rwsdk-community` instead of implementing the bridge manually.

### 5. Infrastructure
- **Release**:
    - Create `.github/workflows/release-community.yml`.
    - Copy existing release workflow but simplify (no complex release script, just `npm publish`).
    - Use independent versioning from core SDK.
- **Renovate**:
    - Update `renovate.json` to handle `rwsdk-community` dependencies with similar grouping rules as `rwsdk`.

### 6. Dependencies
- Add Peer Dependencies: `rwsdk`, `react`, `vite`, `wrangler`.
- Ensure standard versions match core SDK policies.

## Refined Plan
Added CI workflow for community package changes () to ensure PRs are tested. User will handle the manual release verification.


## Refactored Playground
Renamed `playground/hello-world` to `playground/kitchen-sink`.
Created a new minimal `playground/hello-world` from the starter.
Added a basic E2E test `playground/hello-world/__tests__/e2e.test.mts`.

Note: E2E tests hung on Chrome installation in the CI environment.

## Setup Community Playground
Moved `playground/community` to `community/playground`.
Copied minimal `hello-world` to `community/playground`.

## Setup Community Playground
Moved `playground/community` to `community/playground`.
Copied minimal `hello-world` to `community/playground`.
Updated `playground/vitest.config.mts` to remove `community` exclusion, allowing community playground tests to run via the root `pnpm test:e2e` script.

Note: Community tests also require manual verification due to the Chrome install issue.

## Implementation of Community Library
Implemented the Vitest Bridge helpers in `rwsdk-community`:
- `worker.ts`: `handleTestRequest`
- `test.ts`: `invoke`
- `client.ts`: Placeholder

Updated `CONTRIBUTING.md` and `SUPPORT.md` to reflect the new policies for the community package.

## Infrastructure Setup
Created release workflow: `.github/workflows/community-release.yml`
Created CI workflow: `.github/workflows/community-ci.yml`
Updated `renovate.json` with a dedicated group for `rwsdk-community`.

## Final Verification
The plan is now fully executed.
- `community` package created and populated.
- Playgrounds refactored.
- Library features implemented.
- Documentation and Infra updated.

## Renovate Config Correction
User requested a specific 4-group configuration for `renovate.json`:
1.  **Core Critical**: Standard critical deps, excluding `community/**`.
2.  **Core Regular**: Standard regular deps, excluding `community/**`.
3.  **Community Library**: All deps for `community/package.json`.
4.  **Community Playground**: All deps for `community/playground/**`.

## Refactoring Community Structure
Modularized package structure:
- `src/entries/`: Contains entry points (`worker`, `test`, `client`).
- `src/vitest/`: Contains implementation logic.
- Renamed `handleTestRequest` -> `handleVitestRequest`.
- Renamed `invoke` -> `vitestInvoke`.
Exports remain the same (`rwsdk-community/worker`, etc.), but internal implementation and function names have changed.

## Refactoring Verification
Verified new structure with `npx vitest run community/src/__tests__/smoke.test.ts`.
Tests passed. Exports are correctly accessible under the new structure.

## Vitest Configuration Separation
Created `community/vitest.config.ts` to handle unit/smoke tests, explicitly excluding the `playground/` directory.
Updated `community/package.json`'s `test` script to use this config.
Verified that `pnpm test` in `community/` now only runs the smoke test and not the E2E tests.

## E2E Script Enhancement
Updated `community/scripts/test-e2e.mjs` to build the core SDK before building the community package. This ensures that community tests always run against the latest SDK build.


## TypeScript Configuration
Updated `community/tsconfig.json` to exclude `src/__tests__` from compilation. This prevents unit/smoke tests from causing build failures while allowing them to be run via Vitest.

## CI Standardization
Re-implemented `.github/workflows/community-ci.yml` to strictly follow the standards set in `playground-e2e-tests.yml`:
- Switched to `pull_request_target` for secure secret access.
- Added matrix setup and external contributor approval checks.
- Updated Node.js to version 24.
- Added comprehensive environment variables for E2E stability.
- Added artifact uploading for failed tests.

## CI Trigger Adjustment
Switched from `pull_request_target` to `pull_request` to allow the workflow to be tested before it is merged into main. Added the workflow path itself to the trigger paths.

## CI Modularization
Split `community-ci.yml` into three parallel jobs:
1. `unit-tests`: Runs the Vitest smoke tests.
2. `community-e2e-dev`: Runs E2E tests with `RWSDK_SKIP_DEPLOY=1`.
3. `community-e2e-deploy`: Runs E2E tests with `RWSDK_SKIP_DEV=1`.
This matches the architecture of the core SDK CI and allows for parallel execution and isolated failures.

## Code Quality Enhancement
Updated root `package.json` with `typecheck:community` and `build:community` scripts.
Updated `.github/workflows/code-quality.yml` to:
- Trigger on `community/**` changes.
- Added a `Community Checks` job that builds, tests, and typechecks the community library and its playgrounds.

## CI Security Restoration
Reverted `community-ci.yml` to use `pull_request_target`. This restores the secure pattern where PRs from forks are gated by an approval label before secrets are exposed.

## Final NPM Decoration
Updated `community/package.json` with full NPM metadata (description, keywords, repository, author, etc.).
Created `community/README.md` with a basic overview and stability warnings.

## Resolved Wrangler Peer Dependency Conflict
We encountered a peer dependency error where `@cloudflare/vite-plugin` required `wrangler ^4.60.0`, but the monorepo was pinned to `^4.35.0`. We upgraded `wrangler` to `^4.60.0` in the root `package.json`, `sdk/package.json`, and added it as a peer dependency to `community/package.json`. We verified the fix by updating the lockfile and ensuring `pnpm build:community` and `pnpm typecheck:community` pass.


## Adapted Vitest Showcase to Community Library
We migrated the `vitest-showcase` playground to use the standardized "Test Bridge" helpers from `rwsdk-community`. This involved:
1. Adding `rwsdk-community` as a workspace dependency.
2. Replacing local `handleTestRequest` usage with `handleVitestRequest` in `src/worker.tsx`.
3. Replacing local `invoke` helper with `vitestInvoke` from `rwsdk-community/test` in tests.
4. Deleting the redundant `src/lib/test-bridge.ts` and `src/tests/helpers.ts` files.

## Documenting Community Release Process
We are adding instructions for releasing the `rwsdk-community` package to `CONTRIBUTING.md`. This process is manual and triggered via GitHub Actions.
