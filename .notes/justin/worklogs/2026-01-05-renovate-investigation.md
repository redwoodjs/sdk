## Problem

Renovate is creating PRs for the starter peer deps group, but it seems to not be creating PRs for:

- SDK internal deps (`sdk-internal-deps`)
- docs and infra deps (`docs-and-infra-deps`)
- starter deps (`starter-deps`)

The last PRs for these groups appear to be from late September 2025.

## Context

- Repo: `redwoodjs/sdk`
- Renovate config: root `renovate.json`
- Renovate Dependency Dashboard issue: `#743`

## Plan

- Check the Dependency Dashboard for queued/blocked updates, PR limits, or approval requirements.
- Compare the dashboard entries against the current `renovate.json` package rules to see which rules match which updates.
- If it looks like the schedule rules are too narrow (e.g. exact-time schedules), widen them so Renovate has a window to create the weekly grouped PRs.
- If it looks like the negated `matchPackageNames` rules are not behaving as intended, switch to explicit `excludePackageNames` rules.

## Notes (chronological)

- 2026-01-05: Started investigation. Current `renovate.json` uses schedules like `at 00:00 on sunday` for the grouped PRs, and uses negated `matchPackageNames` patterns (e.g. `["!vite"]`, `["!pnpm"]`, etc.).
- 2026-01-05: Checked the public Dependency Dashboard issue HTML (`#743`). It lists checkboxes for `starter-deps`, `docs-and-infra-deps`, and `sdk-internal-deps`, and also includes a checkbox labeled "Create all awaiting schedule PRs at once". This indicates Renovate is detecting the updates and grouping them, but is deferring PR creation because the current time is outside the configured schedule window.
- 2026-01-05: Updated the grouped PR schedules in `renovate.json` from `at 00:00 on sunday` to `every weekend` so Renovate has a window to create the scheduled PRs during its normal runs.

