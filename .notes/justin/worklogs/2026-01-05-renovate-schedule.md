## Problem

Renovate’s Dependency Dashboard shows updates for multiple groups (sdk internal deps, starter deps, docs-and-infra deps), but PRs for those groups have not been created regularly. PRs for the peer-deps group do show up.

## Context

This repo uses Renovate with grouping rules for:

- docs-and-infra-deps
- sdk-internal-deps
- starter-deps
- starter-peer-deps

## Findings

The grouped PRs (docs-and-infra-deps, sdk-internal-deps, starter-deps) were scheduled with:

- `schedule: ["at 00:00 on sunday"]`

That schedule only matches a single instant. If Renovate does not run at exactly that time (in Renovate’s timezone), those rules do not match, and the PRs are not created/updated.

The peer deps group (`starter-peer-deps`) is not schedule-gated, which explains why peer dependency PRs keep appearing while the weekly grouped ones do not.

## Change

Updated the scheduled rules to use `schedule: ["on sunday"]` (full day) instead of `at 00:00 on sunday`, so any Renovate run on Sunday can create/update the weekly grouped PRs.


