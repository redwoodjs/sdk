# 2026-03-05 Investigate puppeteer-core Escaping all-dependencies Group

## Task Narrative
We are investigating why `puppeteer-core` appears as a separate line item on the Renovate Dependency Dashboard instead of being grouped into the `all-dependencies` group with everything else. The current `renovate.json` sets a top-level `groupName: "all-dependencies"`, and we expect ALL dependency updates to land in a single PR. Yet the dashboard shows:
- `fix(deps): update dependency puppeteer-core to ~24.38.0` (separate)
- `fix(deps): update all-dependencies (...)` (grouped, includes `@puppeteer/browsers` but not `puppeteer-core`)

## Synthesized Context
- From 2026-02-23 worklog: We consolidated all Renovate PRs into a single group by setting top-level `groupName: "all-dependencies"` and removing per-rule group names.
- From 2026-01-25 worklog: We previously discovered "Group Hijacking" where wildcard rules or preset rules could override our intended grouping. We also found that combining `schedule` with `groupName` in the same rule caused issues.
- From 2026-02-01 worklog: We found that restrictive `matchManagers` constraints caused packages to fall through to default behavior.
- Current config extends `config:recommended` and ignores `group:monorepos`.

## Investigation

### Root Cause Confirmed: `group:recommended` preset overrides our groupName

We examined the Renovate source code at `lib/config/presets/internal/group.preset.ts` and found:

```typescript
puppeteer: {
    description: 'Group Puppeteer packages together.',
    packageRules: [
      {
        groupName: 'Puppeteer',
        matchDatasources: ['npm'],
        matchPackageNames: ['puppeteer', 'puppeteer-core'],
      },
    ],
  },
```

And crucially, the `group:recommended` preset extends `group:puppeteer`:

```typescript
recommended: {
    description: 'Use curated list of recommended non-monorepo package groupings.',
    extends: [
      ...
      'group:puppeteer',
      ...
    ],
  },
```

Our config extends `config:recommended`, which includes `group:recommended`, which includes `group:puppeteer`. This injects a packageRule that sets `groupName: 'Puppeteer'` for `puppeteer-core`.

**Why this overrides our top-level groupName**: In Renovate, `packageRules` take precedence over top-level config. The preset-injected rule sets `groupName: "Puppeteer"` specifically for `puppeteer-core`, which overrides our top-level `groupName: "all-dependencies"`. Since none of our own packageRules explicitly set `groupName` back to `all-dependencies` for puppeteer-core, the preset wins.

**Why `@puppeteer/browsers` is NOT affected**: The preset only matches `['puppeteer', 'puppeteer-core']`. It does NOT match `@puppeteer/browsers`. So `@puppeteer/browsers` correctly inherits the top-level `groupName: "all-dependencies"`.

### Fix Options
1. Add `"group:puppeteer"` to `ignorePresets` alongside `"group:monorepos"`.
2. Add a catch-all packageRule at the END of our rules that sets `groupName: "all-dependencies"` for all packages (would override any preset groupName).
3. Replace `"group:recommended"` in ignorePresets to remove all such preset groupings.

Option 2 is the most robust: it handles puppeteer and any future preset-injected groups in one rule.

## Draft Plan (RFC)

### 2000ft View Narrative
The `config:recommended` preset chain (`config:recommended` -> `group:recommended` -> `group:puppeteer`) injects a packageRule that sets `groupName: "Puppeteer"` for `puppeteer-core`, overriding our top-level `groupName: "all-dependencies"`. We apply a two-layer fix: ignore `group:recommended` entirely (we want a single group, not curated sub-groups), and add a catch-all packageRule as a safety net against any other preset that might try to override our grouping.

### Implementation Breakdown
1. [MODIFY] `renovate.json`: Add `"group:recommended"` to `ignorePresets`
2. [MODIFY] `renovate.json`: Add a final catch-all packageRule that sets `groupName: "all-dependencies"` for all packages

### Invariants
- All dependency updates must land in the single `all-dependencies` group
- No preset-injected `groupName` should be able to override our intended single-group strategy

### System Flow (Snapshot Diff)
Previous: `config:recommended` -> `group:recommended` -> `group:puppeteer` injects `groupName: "Puppeteer"` for puppeteer-core, splitting it out of our group.
New: `group:recommended` is ignored via `ignorePresets`, and a catch-all rule at the end forces `groupName: "all-dependencies"` for everything.

### Tasks
- [x] Add `"group:recommended"` to `ignorePresets`
- [x] Add catch-all packageRule at end of `packageRules`

## Implementation
Applied both changes to `renovate.json`:
1. Line 4: `"ignorePresets": ["group:monorepos", "group:recommended"]`
2. Lines 69-74: New catch-all rule `{ "matchPackageNames": ["*"], "groupName": "all-dependencies", "groupSlug": "all-dependencies" }` as the final packageRule.

Validated JSON: `node -e "require('./renovate.json')"` succeeded.
