# Work Log: Past Regressions and Behaviors Analysis for E2E Tests

**Date:** 2025-09-22

## Problem

Our project has recently incorporated end-to-end tests in the playground. Previously, we relied on smoke tests that were run against our starters, which included some specific code to test critical paths. To improve our test coverage and prevent recurring issues, we need to identify past regressions and significant user-facing behavior changes that are not currently covered by our e2e tests.

## Plan

1.  Analyze the Git history starting from version 0.2.0, where significant features and regressions started to appear.
2.  For each commit, examine the commit message and diff to understand the change from a user-experience perspective.
3.  Document any identified regressions or behaviors that should have an e2e test. Implementation-specific changes will be ignored.
4.  If a commit does not seem to introduce a testable user-facing change, it will be noted.
5.  This analysis will serve as a basis for writing new playground examples and e2e tests to cover these cases.

## Analysis

This section will contain an analysis for each commit from version 0.2.0 to the current `HEAD`.
### chore: Fix release script for prerelease to actual release (e0f5087c)

This commit fixes a bug in the internal release script. It corrects how `semver` calculates the next version when moving from a prerelease to a stable release.

**Conclusion:** This change affects the internal development process only and has no impact on the end-user experience. No e2e test is necessary.

### feat: Overhaul Production Build and Dev Server Optimization (#666) (0f7ba26a)

TODO: Analyze this commit.
### Merge branch 'stable' (43781110)

TODO: Analyze this commit.
### chore: Remove now-unused clientNavigation.ts (d01b08c7)

TODO: Analyze this commit.
### chore(release): 0.3.0 (4d00a53b)

TODO: Analyze this commit.
### 💬 Minor tweaks to the tutorial (2d149e5b)

TODO: Analyze this commit.
### ✨ Created a GitHub Action for Notifying me of changes made to the tutorial (#670) (04f49240)

TODO: Analyze this commit.
### 💬 Tweaked tutorial for clarity (3ac8e672)

TODO: Analyze this commit.
### fix: Use vite plugins when scanning for directives (#671) (b311d82d)

TODO: Analyze this commit.
### chore(release): 0.3.1 (28051e01)

TODO: Analyze this commit.
### fix: Directive scanner compatibility with vite 7 (#673) (4c7be33c)

TODO: Analyze this commit.
### chore(release): 0.3.2 (3e3a5fa0)

TODO: Analyze this commit.
### fix: Respect server and client environments when scanning for directives (#675) (4d3ebb28)

TODO: Analyze this commit.
### chore(release): 0.3.3 (ebc32d1f)

TODO: Analyze this commit.
### Add scanner arch docs page to index (9ead2cac)

TODO: Analyze this commit.
### fix: Store module env correctly in directive scanner (6533e34f)

TODO: Analyze this commit.
### chore(release): 0.3.4 (aec5c8b7)

TODO: Analyze this commit.
### fix: Use more complete client resolver (#678) (fc95a16d)

TODO: Analyze this commit.
### chore(release): 0.3.5 (f02f98e7)

TODO: Analyze this commit.
### feat: Support importing SSR-based dependencies in worker env (#679) (9767b1dc)

TODO: Analyze this commit.
### chore(release): 0.3.6 (90771183)

TODO: Analyze this commit.
### docs: Remove broken diagram (0d80b2c6)

TODO: Analyze this commit.
### add import (6923ff78)

TODO: Analyze this commit.
### use layout function instead of wrapping the components in a LayoutComponent (bca33395)

TODO: Analyze this commit.
### Merge pull request #672 from redwoodjs/ad-docs-applywize-review (da854ba0)

TODO: Analyze this commit.
### 📝 Auth review (865c7113)

TODO: Analyze this commit.
### dev: 1.0 Planning notes (d33c244f)

TODO: Analyze this commit.
### Merge branch 'main' into ad-docs-applywize-review-part-2 (3e8b19de)

TODO: Analyze this commit.
### Merge branch 'main' of https://github.com/redwoodjs/reloaded into docs-fixes (f9e7a106)

TODO: Analyze this commit.
### Merge branch 'ad-docs-applywize-review-part-2' into docs-fixes (58d5eb3a)

TODO: Analyze this commit.
### 🔼 Upgraded Astro and Expressive Code (a106b2cc)

TODO: Analyze this commit.
### 📝 Revised content for the Authentication section (e420822c)

TODO: Analyze this commit.
### 🔀 Merge pull request #681 from redwoodjs/docs-fixes (647485b6)

TODO: Analyze this commit.
### shadcn docs: path update, note combination, steps rearrange (9c282173)

TODO: Analyze this commit.
### 📝 Fixed Expressive Code block and tweaked text for components.json configuration (3ad893ab)

TODO: Analyze this commit.
### Merge pull request #710 from redwoodjs/pr-620-changes (8dca45b6)

TODO: Analyze this commit.
### Set redirect to manual. (65c65d61)

TODO: Analyze this commit.
### Merge pull request #713 from redwoodjs/pp-fix-redirect-following-in-rsc (886509ca)

TODO: Analyze this commit.
### fix: Handle trailing commas in client component exports (83a981b9)

TODO: Analyze this commit.
### chore(release): 0.3.7 (7444b08f)

TODO: Analyze this commit.
### Fix client side navigation docs. (a95eedb1)

TODO: Analyze this commit.
### tests: Smoke test matrix (#711) (c041c6c3)

TODO: Analyze this commit.
### 📝 Updated the Job List page within the Tutorial (db810a43)

TODO: Analyze this commit.
### Merge pull request #717 from redwoodjs/ad-docs-tutorial-jobs-list (3e362c2a)

TODO: Analyze this commit.
### fix: Prevent module state loss from dev server re-optimization (#718) (34d65bfa)

TODO: Analyze this commit.
### chore(release): 0.3.8 (32816966)

TODO: Analyze this commit.
### chore: Retry each failed smoke test job in the matrix 3 times (5d3ecec3)

TODO: Analyze this commit.
### chore: Avoid non-existent retries api (5fd5b781)

TODO: Analyze this commit.
### fix: Unify request handling for pages and RSC actions (#715) (ca26ef07)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.0 (fd1d91ca)

TODO: Analyze this commit.
### feat(deps): Switch to peer dependency model for React (#708) (a99e9689)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.1 (9862b8e2)

TODO: Analyze this commit.
### feat: Upgrade to Vite v7 (#720) (043c7a23)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.2 (b82a4926)

TODO: Analyze this commit.
### 🚧 WIP: Updates to the Jobs Form page (9b2180cd)

TODO: Analyze this commit.
### chore: Pin deps for starters (6e2527ae)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.3 (a1d13844)

TODO: Analyze this commit.
### Merge branch 'main' of https://github.com/redwoodjs/reloaded into ad-docs-jobs-form (b302f25d)

TODO: Analyze this commit.
### 📝 Finished Jobs Form Page (1fcfe65e)

TODO: Analyze this commit.
### Merge pull request #724 from redwoodjs/ad-docs-jobs-form (077fe602)

TODO: Analyze this commit.
### 📝 Updated the Contacts section of the tutorial (d7513255)

TODO: Analyze this commit.
### Merge pull request #727 from redwoodjs/ad-docs-contacts (5f0ca4f9)

TODO: Analyze this commit.
### fix: Update starter worker types (#729) (50363928)

TODO: Analyze this commit.
### ✨ Added a favicon to the minimal and standard starter (#728) (e7b54b6a)

TODO: Analyze this commit.
### tests: Add more unit tests (#721) (f7457ff3)

TODO: Analyze this commit.
### chore: Use npm pack tarball of sdk for smoke tests (#722) (4b9d2345)

TODO: Analyze this commit.
### 📝 Finsihed making updates to the Jobs Details page of the tutorial (6aaaa8ee)

TODO: Analyze this commit.
### Merge pull request #731 from redwoodjs/ad-docs-jobs-details (a4104786)

TODO: Analyze this commit.
### fix: Avoid duplicate identifiers in build during linking (#732) (4191e4f8)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.4 (7b40a849)

TODO: Analyze this commit.
### fix: Correct vendor module paths in dev directive barrel file (#734) (8a645810)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.5 (3fcb6516)

TODO: Analyze this commit.
### fix: Restore short-circuiting behavior for routes (#738) (75a184a1)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.6 (eb6da3c3)

TODO: Analyze this commit.
### chore: Add pointer-based renovate config for testing greenkeeping (fae306e6)

TODO: Analyze this commit.
### chore: Add pointer-based renovate config for testing greenkeeping (2cc5faab)

TODO: Analyze this commit.
### fix: Use permissive range for React peer dependencies (2e3b87a1)

TODO: Analyze this commit.
### chore: Greenkeeping configuration (#748) (eb1654bb)

TODO: Analyze this commit.
### chore: Ignore cursor user rules dir (c315197a)

TODO: Analyze this commit.
### infra: Playground + E2E test infrastructure (#753) (d0276d54)

TODO: Analyze this commit.
### infra: CI improvements (#755) (f799b9e3)

TODO: Analyze this commit.
### fix: useId() mismatch between SSR and client side (#752) (6cf58859)

TODO: Analyze this commit.
### chore: Change number of CI retries to 6 (0b3784d8)

TODO: Analyze this commit.
### chore(release): 1.0.0-alpha.7 (124525ef)

TODO: Analyze this commit.
### chore: Add dev rule for playground examples (1cf71dfa)

TODO: Analyze this commit.
### Add tests for past regressions and behaviors. (5a8ad7f8)

TODO: Analyze this commit.