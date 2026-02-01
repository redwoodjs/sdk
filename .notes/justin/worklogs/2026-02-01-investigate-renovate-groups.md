# 2026-02-01 Investigate Renovate Grouping Failures

## Investigating Open PRs
We are starting an investigation into why Renovate is opening too many PRs, apparently ignoring grouping rules.
We have confirmed that there are about 14 open PRs, many of which look like dependency updates that should have been grouped.

We are inspecting PR #1012 and #1009 to understand what dependencies they are updating and why they weren't grouped.

## Diagnosis
We found that the "Vertical 4: Infrastructure & Root" group rule in `renovate.json` had a restrictive `matchManagers: ["github-actions"]` setting.
This prevented it from matching dependencies in `package.json` (which are managed by `npm` manager), causing them to fall through to the default catch-all schedule rule which creates individual PRs per dependency.

## Fix
We are removing the `matchManagers` constraint from the Vertical 4 rule. This will allow the rule to match files based on `matchFileNames` regardless of the manager (so `npm` for `package.json`, `nvm` for `.node-version`, etc. will all be captured).
