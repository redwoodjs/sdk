# pnpm overrides require unscoped keys for unscoped packages

## Problem

A pnpm override for `brace-expansion` was declared under the key `@isaacs/brace-expansion@5.0.0: 5.0.5`. The override had no effect — the old version persisted in the lockfile.

## Finding

`brace-expansion` is not a scoped package. pnpm overrides accept a scoped form (`@scope/name@version`) only when the package name itself contains a scope. For unscoped packages, the key must use the bare package name:

```json
// Wrong — @isaacs/ is not part of the package name
"@isaacs/brace-expansion@5.0.0": "5.0.1"

// Correct — unscoped packages use bare name + version range
"brace-expansion@>=5.0.0 <5.0.5": "5.0.5"
```

The broken override silently did nothing. The lockfile still resolved `brace-expansion` to a vulnerable version, and `pnpm audit` continued reporting the issue. The correct override was added in this greenkeeping pass.

## Solution

Always use the package's published name as the override key. For unscoped packages, use the bare name. Use `@scope/name@version` only when the package is actually scoped (e.g. `@hono/node-server@1.19.9` is correct because `hono` scopes under `@hono`).

## Context

Encountered during the 2026-03-31 greenkeeping pass. Three other transitive advisories (path-to-regexp, serialize-javascript×2) were also resolved via pnpm overrides without incident.
