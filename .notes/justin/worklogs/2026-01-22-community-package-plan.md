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
