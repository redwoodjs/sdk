# 2025-09-30: Add renovate globs for addons

## Problem

The renovate configuration does not account for dependencies within `addons/` directories. This means they are not being kept up to date automatically. The contributing documentation also does not mention how addon dependencies are managed.

## Plan

1.  Update `renovate.json` to include `addons/**/package.json` in the file matchers for peer dependencies and infrastructure dependencies, alongside the existing `playground/**/package.json`.
2.  Update the descriptions of the affected rules in `renovate.json` to reflect the inclusion of addons.
3.  Revise `CONTRIBUTING.md` to include addons in the dependency management sections for peer dependencies and infrastructure dependencies.
