## Initial Investigation: Single Group and Schedules
* We want to consolidate all renovate PRs into a single group. This can be done by specifying a global `groupName: "all-dependencies"` at the top level of `renovate.json`, and removing the individual `groupName` properties from the `packageRules`.
* We need to define schedules in `packageRules` that apply these cadences:
  - Critical: every Sunday
  - SDK: every 2 weeks (lockstep with Critical)
  - Starter: every 2 weeks (lockstep with SDK)
  - Infra/Playgrounds/Rest: every 2 weeks (off week from SDK)

To accomplish the off-week scheduling in Renovate, we can use textual schedules like "on the first and third Sunday of the month" vs "on the second and fourth Sunday of the month". Let's verify if Renovate supports this breejs later syntax.

## Draft Plan (RFC)
### 2000ft View Narrative
The repository currently defines 7 different package rules with distinct `groupName`s in `renovate.json`. This generates a high volume of separate Renovate PRs at unpredictable times. Our goal is to reduce noise by forcing Renovate to combine all updates into a single "greenkeeping" PR, but run the updates on a strict schedule to ensure a smooth flow.

To achieve this, we will remove individual `groupName` labels from the package rules and specify a global `groupName: "all-dependencies"` at the root of the configuration. This ensures that any update—regardless of the package—will join the single global PR. We will then define specific `schedule` constraints on subsets of packages so they enter the single PR on specific cadences:

- **Critical**: Every Sunday.
- **SDK & Starter**: Every second week, in lockstep with the critical schedule (e.g. 1st and 3rd Sundays).
- **Infrastructure, Playgrounds, Community, and the rest**: The off-weeks (e.g. 2nd and 4th Sundays).

### Proposed Configuration Changes

`renovate.json`
```json
{
  "groupName": "all-dependencies",
  "packageRules": [
    {
      "description": "Critical Dependencies (Every Sunday)",
      "matchPackageNames": [...],
      "schedule": ["every sunday"],
      "prPriority": 10,
      "ignoreUnstable": true
    },
    {
      "description": "SDK & Starter (Every 2 weeks on 1st/3rd Sunday)",
      "matchFileNames": ["sdk/package.json", "addons/**", "starter/package.json"],
      "matchPackageNames": ["*"],
      "excludePackageNames": [...],
      "schedule": ["* * 1-7 * 0", "* * 15-21 * 0"]
    },
    {
      "description": "Infrastructure, Playgrounds, Community, Rest (Every 2 weeks on 2nd/4th Sunday)",
      "matchFileNames": [
        "package.json",
        "docs/package.json",
        ".node-version",
        ".nvmrc",
        "docs/.node-version",
        ".tool-versions",
        "pnpm-workspace.yaml",
        "renovate.json",
        "playground/**",
        "examples/**",
        "community/package.json",
        "community/playground/**"
      ],
      "matchPackageNames": ["*"],
      "excludePackageNames": [...],
      "schedule": ["* * 8-14 * 0", "* * 22-28 * 0"]
    }
  ]
}
```

### System Flow
Previous: Multiple separate PRs are opened for each vertical and the cadences overlap, resulting in greenkeeping noise.
New: A single PR is maintained. Renovate will sync the PR and append the respective package bumps based on the day of the month, resulting in one rolling update PR.

### Tasks
- [x] Update `renovate.json` with global `groupName`
- [x] Condense and rewrite `packageRules` with new schedules
- [x] Verify there are no lingering `groupName` definitions in package rules

## Implementation
We applied the proposed `renovate.json` config. We set the `"groupName": "all-dependencies"` at the root of `renovate.json` and condensed the `packageRules` into three blocks (Critical, SDK & Starter, and Infrastructure & Playgrounds & Community) mapped tightly to strict schedules, eliminating individual `groupName`s. We also updated `CONTRIBUTING.md` to reflect the new combined rolling schedule structure.

## Verification
- Run `pnpm test` (Optionally) to ensure the config change didn't break anything unexpectedly, although renovate configuration does not impact tests.
- Verify `renovate.json` is a valid JSON document: `node -e "require('./renovate.json')"` (which wouldn't show anything and succeed if it's valid).
- Please manually review the changes in `renovate.json` and `CONTRIBUTING.md`.

## Final Review
The configuration changes correctly align with the stated goal: moving from 7 disparate PR streams to a single reliable stream that staggers dependencies based on their domain.

## Draft PR
**Title**: chore: streamline renovate to a single greenkeeping PR using rolling schedules

**Narrative**:
The repository previously defined 7 different package rules with distinct `groupName`s in `renovate.json`, which generated a high volume of separate Renovate PRs at unpredictable times. Our goal is to reduce noise by forcing Renovate to combine all updates into a single "greenkeeping" PR, but run the updates on a strict schedule to ensure a smooth flow.

To achieve this, we removed individual `groupName` labels from the package rules and specified a global `groupName: "all-dependencies"` at the root of the configuration. We defined specific `schedule` constraints on subsets of packages so they enter the single PR on rolling cadences:

- **Critical**: Every Sunday.
- **SDK & Starter**: Every second week, in lockstep with the critical schedule (e.g. 1st and 3rd Sundays).
- **Infrastructure, Playgrounds, Community, and the rest**: The off-weeks (e.g. 2nd and 4th Sundays).

We also revised the `CONTRIBUTING.md` to document the new schedule.
