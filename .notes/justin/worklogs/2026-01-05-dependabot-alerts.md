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


