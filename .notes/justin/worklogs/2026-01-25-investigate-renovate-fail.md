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

### Plan
- Inspect root and subpackage `package.json` files for `@types/react` and `react` version constraints.
- Examine `pnpm-lock.yaml` to identify why the importer resolution is broken.
- Attempt to reproduce the error locally using `pnpm install`.
- Check `renovate.json` for any relevant grouping or constraints.

### Tasks
- [x] Inspect `@types/react` constraints
- [x] Reproduce pnpm resolution error
- [/] Propose fix (likely widening range or updating constraints)
- [ ] Align vitest version across workspace [ ]

## Identified root cause of resolution failure
We found that many `package.json` files in the monorepo (starters, playgrounds, and addons) have `@types/react` pinned to exactly `19.2.7`. This conflicts with the root and SDK which use `~19.2.7` or are moving to `19.2.9`. 

Additionally, we found Vitest version mismatches:
- Root: `^4.0.0`
- SDK: `~3.2.0`
- Community: `~4.0.0`
- Several playgrounds: `^4.0.0`

We decided to align `@types/react` to `~19.2.7` everywhere and bump all Vitest instances to `~4.0.0` to ensure workspace consistency.

## Analyzed Renovate configuration flaws
We identified several issues in `renovate.json` that contributed to this failure:
1. **Types drift**: `@types/react` was not in the `critical-deps` group, so it was being updated on the weekend schedule, while `react` updates immediately. This creates a window of time where they are out of sync.
2. **Pinned Version "Anchors"**: Many playgrounds pin `@types/react` to an exact version. When root/SDK moves forward, these pinned versions cause pnpm to fail resolution rather than allowing a shared dependency.
3. **Inconsistent Vitest**: Vitest was being updated in the root and community but missing the SDK and some playgrounds due to version range mismatches.

We will fix this by:
- Adding `@types/react`, `@types/react-dom` to the `critical-deps` group.
- Creating a new `repo-tooling` group for `typescript`, `vitest`, `@types/node` (excluding community).
- Converting pinned types to ranges in subpackages.

## Refined "Common Deps" Strategy
The user correctly pointed out that separating groups might lead back to the "same problem" (drift -> conflict).

We refined the strategy to distinguish between **Runtime Compatibility** and **Tooling Autonomy**:
1. **Critical Group (React)**: MUST include `community/**`.
   - Since `community` depends on `sdk`, and both rely on `react`, they must version-match to avoid type errors.
   - We will remove the `!community/**` exclusion for this group.

## Final Strategy
The user pointed out that "Group 2: Regular Deps" already serves the purpose of "Repo Tooling" for the main workspace. Adding a new group is unnecessary.

**Plan**:
1. **Critical Group (Group 1)**: Add `@types/react` & `@types/react-dom`. Remove `!community/**` exclusion.
   - Ensures React + Types stay synced everywhere.
2. **Regular Deps (Group 2)**: Handles `vitest`, `typescript` etc. for SDK/Starters.
3. **Community Deps (Group 3)**: Handles `vitest`, `typescript` for Community.

This achieves the goal with minimal configuration changes.

## Final Resolution: Manifest-First Strategy
We concluded that the `pnpm` resolution failure was caused by Renovate's "Minimal Noise" policy. 

### Technical Rationale: Forcing the Branch
- **The Problem**: Because a new version (19.2.9) satisfied an existing range in the community folder (e.g., `~19.2.7`), Renovate updated **only the shared lockfile**. 
- **The Conflict**: This created a contradiction where the global lockfile record pointed to 19.2.9, but the SDK manifest was still demanding exactly 19.2.7. pnpm hit this contradiction because Renovate hadn't given it a second "Order" (manifest change) to justify a resolution branch.
- **The Fix**: Setting **`rangeStrategy: bump`** forces Renovate to always update the `package.json`. Once both manifests have explicit, distinct requirements, `pnpm` can correctly branch the resolution without conflict.

### Semantic Architecture Plan
We are implementing a 7-group model to balance release control and repo stability:
1. **Horizontal: Critical Dependencies** (`ASAP`): Repo-wide sync for React, Vite, and Cloudflare tools.
2. **Vertical: SDK**: Unique SDK dependencies.
3. **Vertical: Starter**: Unique Starter dependencies.
4. **Vertical: Community Lib**: Unique Community library dependencies.
5. **Vertical: Infrastructure**: Shared tooling (TS, Vitest, ESLint).
6. **Vertical: SDK Playgrounds**: Example-specific dependencies.
7. **Vertical: Community Playgrounds**: Community example dependencies.
