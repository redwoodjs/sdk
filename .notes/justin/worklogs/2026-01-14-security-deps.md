# 2026-01-14 security deps

## Problem

GitHub alerts report:

- @modelcontextprotocol/sdk - ReDoS
- hono - JWT algorithm confusion (jwt + jwk middleware)

Goal: bump SDK direct deps in `sdk/`, and for transitive-only deps apply a monorepo-root override, then update the lockfile.

## Plan

- Find the affected versions currently in `pnpm-lock.yaml` and which workspace pulls them in.
- Find the patched versions from advisories.
- Apply bumps/overrides, regenerate `pnpm-lock.yaml`, and confirm with `pnpm why`.

## Findings

`pnpm-lock.yaml` shows:

- `playground/shadcn` depends on `shadcn` (CLI)
- `shadcn` depends on `@modelcontextprotocol/sdk@1.25.1` and `hono@4.11.3`

Root `package.json` already had an override pinning `@modelcontextprotocol/sdk`, but it pinned to `1.25.1`, which still appears to be in the affected range for the ReDoS advisory.

Attempted `pnpm -w install --ignore-scripts` after updating overrides, but pnpm rejected it due to a lockfile/config mismatch (frozen install). Next step is to run with `--no-frozen-lockfile` so the lock can update.

After updating overrides and running install, `@modelcontextprotocol/sdk` moved to `1.25.2`, but `hono` stayed at `4.11.3` even though the registry shows `4.11.4` exists and is tagged `latest`. Next step is to try a more specific override selector (`hono@4.11.3` -> `4.11.4`) to force the lock to move.

The override selector showed up in the lockfile config, but the resolved `hono` package stayed at `4.11.3`. It seems like this is coming from peer auto-install rather than a normal dependency edge, so I added `hono@4.11.4` as a devDependency of `playground/shadcn` to satisfy the peer at a known patched version.

After re-installing, the lockfile now resolves:

- `@modelcontextprotocol/sdk` at `1.25.2`
- `hono` at `4.11.4`

