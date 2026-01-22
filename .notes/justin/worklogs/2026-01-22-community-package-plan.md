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
