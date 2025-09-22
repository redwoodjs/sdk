# Work Log: Past Regressions and Behaviors Analysis

**Date:** 2025-09-22

## Brief

-   **Goal**: Analyze git history from commit `a3e3f1ebcedf3c37fc070801786ea51bd3518031` to identify user-experience regressions and behaviors that are not covered by existing end-to-end tests.
-   **Process**:
    1.  Go through each commit from the specified starting point.
    2.  For each commit, analyze the commit message, body, and diff to understand changes.
    3.  Identify user-facing behavioral changes and regressions.
    4.  Document findings for each commit in this work log.
-   **Outcome**: A comprehensive list of past regressions and behaviors that can be used to create new playground e2e tests, improving test coverage and preventing future regressions.

---

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
### chore: Fix release script for prerelease to actual release (e0f5087c)\n\nTODO: Analyze this commit.\n
### feat: Overhaul Production Build and Dev Server Optimization (#666) (0f7ba26a)\n\nTODO: Analyze this commit.\n
### Merge branch 'stable' (43781110)\n\nTODO: Analyze this commit.\n
### chore: Remove now-unused clientNavigation.ts (d01b08c7)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.0 (4d00a53b)\n\nTODO: Analyze this commit.\n
### 💬 Minor tweaks to the tutorial (2d149e5b)\n\nTODO: Analyze this commit.\n
### ✨ Created a GitHub Action for Notifying me of changes made to the tutorial (#670) (04f49240)\n\nTODO: Analyze this commit.\n
### 💬 Tweaked tutorial for clarity (3ac8e672)\n\nTODO: Analyze this commit.\n
### fix: Use vite plugins when scanning for directives (#671) (b311d82d)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.1 (28051e01)\n\nTODO: Analyze this commit.\n
### fix: Directive scanner compatibility with vite 7 (#673) (4c7be33c)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.2 (3e3a5fa0)\n\nTODO: Analyze this commit.\n
### fix: Respect server and client environments when scanning for directives (#675) (4d3ebb28)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.3 (ebc32d1f)\n\nTODO: Analyze this commit.\n
### Add scanner arch docs page to index (9ead2cac)\n\nTODO: Analyze this commit.\n
### fix: Store module env correctly in directive scanner (6533e34f)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.4 (aec5c8b7)\n\nTODO: Analyze this commit.\n
### fix: Use more complete client resolver (#678) (fc95a16d)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.5 (f02f98e7)\n\nTODO: Analyze this commit.\n
### feat: Support importing SSR-based dependencies in worker env (#679) (9767b1dc)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.6 (90771183)\n\nTODO: Analyze this commit.\n
### docs: Remove broken diagram (0d80b2c6)\n\nTODO: Analyze this commit.\n
### add import (6923ff78)\n\nTODO: Analyze this commit.\n
### use layout function instead of wrapping the components in a LayoutComponent (bca33395)\n\nTODO: Analyze this commit.\n
### Merge pull request #672 from redwoodjs/ad-docs-applywize-review (da854ba0)\n\nTODO: Analyze this commit.\n
### 📝 Auth review (865c7113)\n\nTODO: Analyze this commit.\n
### dev: 1.0 Planning notes (d33c244f)\n\nTODO: Analyze this commit.\n
### Merge branch 'main' into ad-docs-applywize-review-part-2 (3e8b19de)\n\nTODO: Analyze this commit.\n
### Merge branch 'main' of https://github.com/redwoodjs/reloaded into docs-fixes (f9e7a106)\n\nTODO: Analyze this commit.\n
### Merge branch 'ad-docs-applywize-review-part-2' into docs-fixes (58d5eb3a)\n\nTODO: Analyze this commit.\n
### 🔼 Upgraded Astro and Expressive Code (a106b2cc)\n\nTODO: Analyze this commit.\n
### 📝 Revised content for the Authentication section (e420822c)\n\nTODO: Analyze this commit.\n
### 🔀 Merge pull request #681 from redwoodjs/docs-fixes (647485b6)\n\nTODO: Analyze this commit.\n
### shadcn docs: path update, note combination, steps rearrange (9c282173)\n\nTODO: Analyze this commit.\n
### 📝 Fixed Expressive Code block and tweaked text for components.json configuration (3ad893ab)\n\nTODO: Analyze this commit.\n
### Merge pull request #710 from redwoodjs/pr-620-changes (8dca45b6)\n\nTODO: Analyze this commit.\n
### Set redirect to manual. (65c65d61)\n\nTODO: Analyze this commit.\n
### Merge pull request #713 from redwoodjs/pp-fix-redirect-following-in-rsc (886509ca)\n\nTODO: Analyze this commit.\n
### fix: Handle trailing commas in client component exports (83a981b9)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.7 (7444b08f)\n\nTODO: Analyze this commit.\n
### Fix client side navigation docs. (a95eedb1)\n\nTODO: Analyze this commit.\n
### tests: Smoke test matrix (#711) (c041c6c3)\n\nTODO: Analyze this commit.\n
### 📝 Updated the Job List page within the Tutorial (db810a43)\n\nTODO: Analyze this commit.\n
### Merge pull request #717 from redwoodjs/ad-docs-tutorial-jobs-list (3e362c2a)\n\nTODO: Analyze this commit.\n
### fix: Prevent module state loss from dev server re-optimization (#718) (34d65bfa)\n\nTODO: Analyze this commit.\n
### chore(release): 0.3.8 (32816966)\n\nTODO: Analyze this commit.\n
### chore: Retry each failed smoke test job in the matrix 3 times (5d3ecec3)\n\nTODO: Analyze this commit.\n
### chore: Avoid non-existent retries api (5fd5b781)\n\nTODO: Analyze this commit.\n
### fix: Unify request handling for pages and RSC actions (#715) (ca26ef07)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.0 (fd1d91ca)\n\nTODO: Analyze this commit.\n
### feat(deps): Switch to peer dependency model for React (#708) (a99e9689)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.1 (9862b8e2)\n\nTODO: Analyze this commit.\n
### feat: Upgrade to Vite v7 (#720) (043c7a23)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.2 (b82a4926)\n\nTODO: Analyze this commit.\n
### 🚧 WIP: Updates to the Jobs Form page (9b2180cd)\n\nTODO: Analyze this commit.\n
### chore: Pin deps for starters (6e2527ae)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.3 (a1d13844)\n\nTODO: Analyze this commit.\n
### Merge branch 'main' of https://github.com/redwoodjs/reloaded into ad-docs-jobs-form (b302f25d)\n\nTODO: Analyze this commit.\n
### 📝 Finished Jobs Form Page (1fcfe65e)\n\nTODO: Analyze this commit.\n
### Merge pull request #724 from redwoodjs/ad-docs-jobs-form (077fe602)\n\nTODO: Analyze this commit.\n
### 📝 Updated the Contacts section of the tutorial (d7513255)\n\nTODO: Analyze this commit.\n
### Merge pull request #727 from redwoodjs/ad-docs-contacts (5f0ca4f9)\n\nTODO: Analyze this commit.\n
### fix: Update starter worker types (#729) (50363928)\n\nTODO: Analyze this commit.\n
### ✨ Added a favicon to the minimal and standard starter (#728) (e7b54b6a)\n\nTODO: Analyze this commit.\n
### tests: Add more unit tests (#721) (f7457ff3)\n\nTODO: Analyze this commit.\n
### chore: Use npm pack tarball of sdk for smoke tests (#722) (4b9d2345)\n\nTODO: Analyze this commit.\n
### 📝 Finsihed making updates to the Jobs Details page of the tutorial (6aaaa8ee)\n\nTODO: Analyze this commit.\n
### Merge pull request #731 from redwoodjs/ad-docs-jobs-details (a4104786)\n\nTODO: Analyze this commit.\n
### fix: Avoid duplicate identifiers in build during linking (#732) (4191e4f8)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.4 (7b40a849)\n\nTODO: Analyze this commit.\n
### fix: Correct vendor module paths in dev directive barrel file (#734) (8a645810)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.5 (3fcb6516)\n\nTODO: Analyze this commit.\n
### fix: Restore short-circuiting behavior for routes (#738) (75a184a1)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.6 (eb6da3c3)\n\nTODO: Analyze this commit.\n
### chore: Add pointer-based renovate config for testing greenkeeping (fae306e6)\n\nTODO: Analyze this commit.\n
### chore: Add pointer-based renovate config for testing greenkeeping (2cc5faab)\n\nTODO: Analyze this commit.\n
### fix: Use permissive range for React peer dependencies (2e3b87a1)\n\nTODO: Analyze this commit.\n
### chore: Greenkeeping configuration (#748) (eb1654bb)\n\nTODO: Analyze this commit.\n
### chore: Ignore cursor user rules dir (c315197a)\n\nTODO: Analyze this commit.\n
### infra: Playground + E2E test infrastructure (#753) (d0276d54)\n\nTODO: Analyze this commit.\n
### infra: CI improvements (#755) (f799b9e3)\n\nTODO: Analyze this commit.\n
### fix: useId() mismatch between SSR and client side (#752) (6cf58859)\n\nTODO: Analyze this commit.\n
### chore: Change number of CI retries to 6 (0b3784d8)\n\nTODO: Analyze this commit.\n
### chore(release): 1.0.0-alpha.7 (124525ef)\n\nTODO: Analyze this commit.\n
### chore: Add dev rule for playground examples (1cf71dfa)\n\nTODO: Analyze this commit.\n
### Add tests for past regressions and behaviors. (5a8ad7f8)\n\nTODO: Analyze this commit.\n
### 5d0a85d654c03de9d95c589061e36b5b816547cc docs: fix database tutorial

**Analysis:** This commit only contains documentation changes, specifically fixing file paths in the database tutorial. There are no changes to the framework's code or its user-facing behavior.

**Action:** No action needed. This is not a regression or a new behavior to test.

### 6e30e2cc9a969fa75758c20c2a6f677db1170ebb Revert "Update doc 'tutorial/full-stack-app/9-deploying.mdx'"

**Analysis:** This is a revert of a documentation change in the deployment tutorial. It has no impact on the framework's behavior.

**Action:** No action needed.

### a3e3f1ebcedf3c37fc070801786ea51bd3518031 Rsc bundling implementation v2 (#488)

**Analysis:**

This is a major architectural change that introduces the second version of the React Server Components (RSC) bundling implementation. It fundamentally changes how components are rendered and how client-server interaction is handled.

-   **`"use client"` directive:** Files with this directive are treated as client components.
    -   In the browser and for SSR, the directive is removed, and the component code is used as-is.
    -   In the worker (RSC) environment, the component is replaced with a `registerClientReference`, which is a serializable reference that the browser can use to fetch the component's code.
-   **`"use server"` directive:** Files with this directive contain server actions.
    -   On the client and for SSR, functions from these modules are replaced with `createServerReference` stubs that can call the server.
    -   In the worker, the actual functions are registered with `registerServerReference` to be callable.

This enables a hybrid rendering model where server components (default) can fetch data and render on the server, while client components can be interactive in the browser.

**Behaviors to test:**

-   A component marked with `"use client"` renders on the server and hydrates on the client.
-   A regular component (server component) renders only on the server.
-   A client component can render server components passed as children.
-   Functions from a `"use server"` module can be called from client components and execute on the server.
-   Server components can fetch data on the server side.
-   Named, default, and aliased exports for both client components and server actions function correctly.

### c8e6b9580438c3594841e7cbf029c3f8d7c39f69 chore: Support preview releases in release script

**Analysis:** This commit updates the release script to support publishing preview releases (e.g., alpha, beta, rc). This is a tooling change for the project's maintainers and has no impact on the behavior of the framework for users.

**Action:** No action needed.

### dcf356005419574b6ba006fc81d36e48425fa33c progress

**Analysis:** This commit further refines the release script, building on the changes from the previous commit. It improves the handling of prereleases by adding support for `prepatch`, `preminor`, and `premajor` version bumps and a `--preid` flag for custom prerelease identifiers. This is a developer tooling change and has no effect on the framework's user-facing behavior.

**Action:** No action needed.

### 241e158f952e9ed5ecc1b7eaa161090087281bee chore(release): 0.1.0-alpha.0