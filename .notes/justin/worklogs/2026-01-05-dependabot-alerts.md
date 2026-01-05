# 2026-01-05 - dependabot alerts sweep

## Context

- GitHub is reporting multiple security alerts against packages pinned in `pnpm-lock.yaml`.
- We did not receive Dependabot PRs for these, so the updates need to be done manually in this worktree.

## Problem

- The lockfile currently resolves versions of several packages with published advisories.
- Most of these are transitive, so updating a direct dependency might not be sufficient without using workspace overrides.

## Plan

- Identify which versions are currently resolved for each flagged package and which workspace packages pull them in.
- Determine the patched versions and the smallest upgrade surface (direct bumps where appropriate, otherwise `pnpm.overrides`).
- Update the lockfile and run a small set of repo checks to confirm the dependency graph still builds.

## Notes

- Starting point: inventory vulnerabilities from GitHub alerts and map them to `pnpm-lock.yaml` resolutions.

- Ran `pnpm audit --json` to get patched version ranges and preferred targets.
- Plan is to apply targeted `pnpm.overrides` for the vulnerable resolved versions, then refresh `pnpm-lock.yaml`.

- Added `pnpm.overrides` in the workspace root for the vulnerable resolved versions (qs, tar-fs, MCP SDK, glob v10, mdast-util-to-hast, tar, vite v7.1.x, body-parser, tmp, esbuild v0.18/0.19, js-yaml 4.1.0).
- Refreshed `pnpm-lock.yaml` with `pnpm -w install --lockfile-only`.
- `pnpm audit --json` is now clean.

- Added `.github/dependabot.yml` with `open-pull-requests-limit: 0` so scheduled version update PRs are suppressed. Security update PRs are handled by the GitHub setting.


## PR Title & Description

**Title:** chore: resolve dependabot alerts and configure security-only updates

**Description:**

Resolves multiple security alerts reported by Dependabot by applying targeted overrides and ensuring the repo is configured for security updates.

### Changes

- Added `pnpm.overrides` to `package.json` for the following packages to force patched versions:
    - `@modelcontextprotocol/sdk` ([GHSA-w48q-cv73-mx4w](https://github.com/advisories/GHSA-w48q-cv73-mx4w))
    - `body-parser` ([GHSA-wqch-xfxh-vrr4](https://github.com/advisories/GHSA-wqch-xfxh-vrr4))
    - `esbuild` ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99))
    - `glob` ([GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2))
    - `js-yaml` ([GHSA-mh29-5h37-fv8m](https://github.com/advisories/GHSA-mh29-5h37-fv8m))
    - `mdast-util-to-hast` ([GHSA-4fh9-h7wg-q85m](https://github.com/advisories/GHSA-4fh9-h7wg-q85m))
    - `qs` ([GHSA-6rw7-vpxm-498p](https://github.com/advisories/GHSA-6rw7-vpxm-498p))
    - `tar`, `tar-fs` ([GHSA-29xp-372q-xqph](https://github.com/advisories/GHSA-29xp-372q-xqph), [GHSA-vj76-c3g6-qr5v](https://github.com/advisories/GHSA-vj76-c3g6-qr5v))
    - `tmp` ([GHSA-52f5-9888-hmc6](https://github.com/advisories/GHSA-52f5-9888-hmc6))
    - `vite` ([GHSA-93m4-6634-74q7](https://github.com/advisories/GHSA-93m4-6634-74q7))
- Refreshed `pnpm-lock.yaml` to apply these resolutions.
- Added `.github/dependabot.yml` configured with `open-pull-requests-limit: 0` to enable the configuration required for Dependabot while preventing scheduled version-update PRs (relying on repo settings for security PRs).

### Verification

- `pnpm audit` is clean (0 vulnerabilities).
- `pnpm check` (build + typecheck) passes.
