# Investigate failing Renovate PR 2026-01-25

## Starting investigation of Renovate PR failures
###
We are investigating a recurring Renovate failure where `@types/react` updates are split into multiple PRs, causing `pnpm` resolution errors. We found that the current `renovate.json` allows wildcard rules for community packages to "hijack" core dependencies, breaking the synchronization required for pinned versions.

## Discovered root cause: Group Hijacking
even after moving packages to Group 1, Renovate's wildcard rules for community (Group 3/4) were still matching them because they appear later in the configuration. 
- Group 1: Matches `@types/react` (Global)
- Group 3: Matches `community/**` + `*` (Any package)
Because Group 3 is more specific (file path) or later in the list, Renovate split the updates. 
Since these are **pinned**, `pnpm install` in the Group 3 PR fails because `starter/package.json` is still on `19.2.7` while `community/package.json` is on `19.2.9`.

## Architectural Priority Assessment
We identified the following priority tiers for the monorepo:
1. **SDK & Starter**: Primary product, requires tightest control.
2. **Community Library**: Secondary product, managed by community but depends on SDK.
3. **Infrastructure/Tooling**: External deps like TS/Vitest. Should not force product releases.
4. **Playgrounds/Showcase**: Lower priority examples.

## Final Resolution: Manifest-First Strategy
We concluded that the `pnpm` resolution failure was caused by Renovate's "Minimal Noise" policy. 

### Technical Rationale: Forcing the Branch
- **The Problem**: Because a new version (19.2.9) satisfied an existing range in the community folder (e.g., `~19.2.7`), Renovate updated **only the shared lockfile**. 
- **The Conflict**: This created a contradiction where the global lockfile record pointed to 19.2.9, but the SDK manifest was still demanding exactly 19.2.7. pnpm hit this contradiction because Renovate hadn't given it a second "Order" (manifest change) to justify a resolution branch.
- **The Fix**: Setting **`rangeStrategy: bump`** forces Renovate to always update the `package.json`. Once both manifests have explicit, distinct requirements, `pnpm` can correctly branch the resolution without conflict.

### Semantic Architecture Plan
We are implementing a 7-vertical model to balance release control and repo stability:
1. **Horizontal: Critical Dependencies** (`ASAP`): Repo-wide sync for React, Vite, and Cloudflare tools.
2. **Vertical 1: SDK & Addons**: Core SDK logic and official extensions.
3. **Vertical 2: Starter**: Unique Starter dependencies.
4. **Vertical 3: Community Lib**: Community-led evolution.
5. **Vertical 4: Infrastructure**: Shared tooling (TS, Vitest, ESLint) + Root Overrides + Docs.
6. **Vertical 5: SDK Playgrounds & Examples**: Official demonstration environments.
7. **Vertical 6: Community Playgrounds**: Community showcases.

## Fixing Fine-Grained PR Leakage (2026-01-26)
We observed that incidental dependencies in the root `package.json` (e.g., `body-parser`, `@manypkg/cli`) were being updated in individual PRs.
- **Diagnosis**: The `infra-deps` rule was too restrictive (explicitly listing TS/Vitest/etc.).
- **Fix**: Broadened `infra-deps` to use `matchPackageNames: ["*"]` for the root `package.json`.
- **Exhaustiveness**: Ensured all monorepo directories (`addons/`, `docs/`, `examples/`) are explicitly mapped to a vertical to prevent them from defaulting to individual PRs.
