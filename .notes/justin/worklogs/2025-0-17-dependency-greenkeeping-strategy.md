The temporary and now-obsolete GitHub Action workflow files will be deleted from this branch.

### Step 11: Correcting the Pointer Syntax

After installing the Renovate App and creating the pointer configuration on `main`, Renovate produced an error: `Cannot find preset's package (github>redwoodjs/sdk:greenkeep-now-and-ongoing)`.

**Finding:**

The syntax used in the pointer `renovate.json` on the `main` branch was incorrect. A colon (`:`) is used to specify a file path within a repository's default branch. To reference a configuration on a different branch, a hash (`#`) must be used to specify the git ref.

**Action:**

The pointer `renovate.json` on the `main` branch must be corrected to use the `#` syntax. The correct configuration is:
`{ "extends": ["github>redwoodjs/sdk#greenkeep-now-and-ongoing"] }`

This change will allow the Renovate App to correctly locate and apply the configuration from our feature branch.

### Step 12: Refining Grouping Rules

The Renovate App successfully ran but produced more individual PRs than expected, indicating a problem with the grouping rules.

**Finding:**

An analysis of the "Dependency Dashboard" issue created by Renovate revealed three issues:
1.  A conflicting `packageRules` entry was explicitly excluding `@cloudflare/workers-types` from one group, preventing it from being included in the main `cloudflare` group.
2.  The `config:recommended` preset was separating major version updates into their own PRs by default.
3.  There were no rules to handle dependencies outside of the `sdk/` and `starters/` directories (e.g., in `docs/` or the root `package.json`), causing them to generate individual PRs.

**Action:**

The `renovate.json` configuration has been updated to address these findings:
1.  The conflicting exclusion for `@cloudflare/workers-types` has been removed.
2.  `separateMajorMinor: false` has been added to the root of the configuration to keep major updates within their defined groups.
3.  A new "catch-all" rule has been added to the end of the `packageRules` array. This rule will group all previously unmatched dependencies into a single weekly "repository-maintenance" PR.

### Step 13: Implementing Dashboard-Driven Fixes

The initial run of the Renovate App with the corrected pointer syntax revealed several issues with our grouping rules. The Dependency Dashboard provided all the necessary information to diagnose and fix them.

**Findings:**

1.  **Incorrect Grouping**: A single, overly broad "catch-all" rule was grouping all dependencies into a single `repository-maintenance` PR, overriding all other specific rules.
2.  **Deprecated Filename**: A warning indicated that when a configuration is used as a preset (as ours is via the pointer), it should be named `default.json`, not `renovate.json`.
3.  **Missing "Infrastructure" Group**: Several dependencies related to repository infrastructure (e.g., GitHub Actions, Docker) were not explicitly grouped.

**Actions:**

1.  **Renamed Config File**: `renovate.json` has been renamed to `default.json` to align with Renovate's preset conventions and resolve the warning.
2.  **Refined Grouping Rules**: The `default.json` file has been significantly updated. The overly broad catch-all rule was removed and replaced with several explicit rules to correctly group dependencies from the `sdk`, `starters`, `docs`, and root `package.json` files.
3.  **Added Infrastructure Group**: A new `infrastructure-dependencies` group was created to handle updates for GitHub Actions, Dockerfiles, and the repository's Node.js version.
4.  **Updated Documentation**: The `CONTRIBUTING.md` file has been updated with a section explaining how to use the Dependency Dashboard to monitor and manually trigger updates.

With these changes, the configuration should now be correct and robust. The next run of Renovate should produce the correctly grouped PRs as originally intended.

### Step 14: Expanding the Peer Dependency Group

A review of the `sdk` and `starters` `package.json` files revealed that the `starter-peer-dependencies` group was incomplete. It was missing the critical `react` packages and their associated types.

**Finding:**

The initial focus was on the Cloudflare and Vite dependencies, but `react`, `react-dom`, `react-server-dom-webpack`, and their corresponding `@types/*` packages are also essential peer dependencies for the starter projects. For maximum stability, these packages and their types should be updated together with the other peer dependencies in the high-priority group.

**Action:**

The `default.json` configuration has been updated to expand the `starter-peer-dependencies` group. This group now includes all `react` packages and their types, as well as `@cloudflare/workers-types`. The `starter-app-dependencies` group has also been updated to exclude these packages, preventing any grouping conflicts.
