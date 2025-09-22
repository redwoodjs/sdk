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
### chore: Fix release script for prerelease to actual release (e0f5087c)

TODO: Analyze this commit.

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

### 5d0a85d654c03de9d95c589061e36b5b816547cc docs: fix database tutorial

**Analysis:** This commit only contains documentation changes, specifically fixing file paths in the database tutorial. There are no changes to the framework's code or its user-facing behavior.

**Action:** No action needed. This is not a regression or a new behavior to test.

### 6e30e2cc9a969fa75758c20c2a6f677db1170ebb Revert "Update doc 'tutorial/full-stack-app/9-deploying.mdx'"

**Analysis:** This is a revert of a documentation change in the deployment tutorial. It has no impact on the framework's behavior.

**Action:** No action needed.

### f615f6825dec50a274f8c317d975ae79055e3b48 Merge pull request #496 from jonotron/patch-1

**Analysis:** This is a merge commit for the previous documentation change. It introduces no new changes.

**Action:** No action needed.

### 360a08ef35626d798c9ae6d3b4063677678026da docs: remove note

**Analysis:** This commit removes a note from the authentication documentation. It has no impact on the framework's behavior.

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

**Analysis:** This is a release commit for version `0.1.0-alpha.0`. It only contains version bumps in `package.json` files and updates to the lockfile. There are no changes to the framework's code or behavior.

**Action:** No action needed.

### b0b7e3090e918942e71f5ffdd5fc0d830f6d069c chore: Skip starter update for prereleases

**Analysis:** This commit modifies the release script to skip updating dependencies in starter projects when publishing a prerelease version. This is a workflow improvement for maintainers and has no impact on the framework's user-facing functionality.

**Action:** No action needed.

### 6d4ec6fd123d72e5ed1e95e29e56617edaa2a4dc chore: Switch back to 0.0.88 for starters

**Analysis:** This commit reverts the `rwsdk` dependency in the starter projects from `0.1.0-alpha.0` back to `0.0.88`. This is a maintenance task to keep the starter projects pointing to a stable version while prereleases are being worked on. It does not change the framework's code.

**Action:** No action needed.

### da78f78221d4e309339cc6cf5d94f5f85cd97178 fix: Only check for directives for {js,mjs,cjs} in node_modules (#490)

**Analysis:** This commit changes the directive scanning logic for files inside `node_modules`. Instead of looking for TypeScript and JSX files (`.ts`, `.tsx`, etc.), it now only scans for JavaScript files (`.js`, `.mjs`, `.cjs`). This is based on the assumption that packages in `node_modules` are already transpiled. This change improves the robustness of using third-party libraries that contain `use client` or `use server` directives.

**Behaviors to test:**

-   A client component from a third-party package in `node_modules` (as a `.js`, `.mjs`, or `.cjs` file) is correctly treated as a client component.
-   A server action from a third-party package is correctly identified and executed on the server.

### 9b72f83367e2b7feac657ca15e5fe0c584de54f5 chore: Remove unused chokidar dep (#491)

**Analysis:** This commit removes the `chokidar` dependency, which was unused. This is a simple dependency cleanup and has no impact on the framework's behavior.

**Action:** No action needed.

### 62675ed5c3161f326edc3177a6b25c199f956182 chore(release): 0.1.0-alpha.1

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.1`. It contains no code changes.

**Action:** No action needed.

### 33e0a3b507867fbfe5d662796052d9b7fbcbe2dd fix: Aliased exports to already exported component for "use client" (#493)

**Analysis:** This commit fixes a bug in the transformation of `"use client"` modules where a component exported with an alias would cause a syntax error. The issue occurred when a component was exported under both its original name and an alias, leading to a redeclaration of the same constant. The fix ensures that a unique local variable is created for the aliased export.

This is an important fix for compatibility with component libraries that use this export pattern.

**Behaviors to test:**

-   A client component exported with an alias (e.g., `export { MyComponent as MyAlias }`) works as expected.
-   A client component exported under its original name and one or more aliases from the same file (e.g., `export { Button, Button as PrimaryButton }`) works correctly.

### 6f69a777fefc7838519ad09535c382d06aa4718e chore(release): 0.1.0-alpha.2

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.2`. It contains no code changes.

**Action:** No action needed.

### 08b147dcb7e2424756b6f4cc29f19adac8924447 fix: Separate entry point for client SSR (#494)

**Analysis:** This commit addresses a critical issue where importing `rwsdk/client` in a `"use client"` component would cause browser-specific code to run during SSR in the worker environment, leading to unexpected behavior. The fix introduces a separate entry point (`clientSSR.ts`) for the `rwsdk/client` package when it's imported in a `workerd` environment (i.e., during SSR). This ensures that only SSR-safe code is loaded on the server, preventing conflicts and errors.

**Behaviors to test:**

-   A client component that imports from `rwsdk/client` can be server-side rendered without errors.
-   The client-side functionality of `rwsdk/client` remains unaffected and works as expected after hydration.

### 2d5973a385021ed323fd7b6d0fe89270d2de2bd1 chore(release): 0.1.0-alpha.3

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.3`. It contains no code changes.

**Action:** No action needed.

### da433e3b244f5c1c247ef2e4e9154444b61dabc3 docs: update minimal README to use minimal template

**Analysis:** This commit updates the README for the `minimal` starter project to include the necessary `-t minimal` flag in the project creation command. This is a documentation-only change.

**Action:** No action needed.

### fd9888b8749c7f4c1016cc0f7a1124610f9fcf89 Merge pull request #497 from bb-at-easley/patch-2

**Analysis:** This is a merge commit for the previous documentation change. It introduces no new changes.

**Action:** No action needed.

### 929bd24a281489aa76e755f7b101e42a4c2c4b9a fix: Use tsconfig paths for directive scans (#501)

**Analysis:** This commit improves the directive scanning process by using the project's `tsconfig.json` to identify which files to scan. Instead of a simple glob, it now parses the `tsconfig.json` to get a precise list of source files, respecting the `include`, `exclude`, and path alias configurations. This makes the scanning more accurate and efficient, especially in projects with custom path aliases.

**Behaviors to test:**

-   Directives in files imported via a `tsconfig.json` path alias are correctly processed.
-   The directive scanner respects the `include` and `exclude` rules in `tsconfig.json`, and files in excluded directories are not scanned.

### 4ad67fe05a1bc35cb84deaafd7de859ac94f9e9d fix: Ensure .js extension when resolving ssr bridge in builds (#502)

**Analysis:** This commit fixes a build issue where the SSR bridge module was being generated with a `.mjs` extension in projects without `"type": "module"` in their `package.json`. The RSC worker, however, expected a `.js` extension, causing the build to fail. The fix forces the SSR bridge to always be built with a `.js` extension, ensuring that production builds are successful regardless of the project's module type.

**Behaviors to test:**

-   A production build of a project without `"type": "module"` in its `package.json` completes successfully and runs correctly.

### 15ebb5ab36e9b686a85d00346eddf895595ed067 chore(release): 0.1.0-alpha.4

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.4`. It contains no code changes.

**Action:** No action needed.

### a719ff1dc56121de643e2c502605b05ef5d2736f fix: Exclude cloudflare builtins from SSR environment (#507)

**Analysis:** This commit fixes an issue where Vite's dependency optimizer would try to bundle Cloudflare's built-in modules (e.g., `cloudflare:email`, `cloudflare:sockets`) in the SSR environment. Since these modules are provided by the Cloudflare runtime, they should not be bundled. The fix excludes these modules from the optimization process, ensuring that server-side code can correctly resolve and use Cloudflare-specific APIs.

**Behaviors to test:**

-   Importing and using Cloudflare built-in modules in server-side code works correctly in both development and production, without causing build or runtime errors.

### 3d6ecfcd09b692834031fcc0ba73b246309936cf chore(release): 0.1.0-alpha.5

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.5`. It contains no code changes.

**Action:** No action needed.

### 9c4f8500ae509eedbd0c5e8eff76590b7b9c71ae fix: Skip dirs with .js extensions (#509)

**Analysis:** This commit fixes a bug where the directive scanner would mistakenly identify directories with `.js` in their names as files, leading to errors. The fix adds the `nodir: true` option to the glob pattern used for file discovery, ensuring that only files are scanned.

**Behaviors to test:**

-   The build process does not fail if there is a directory in the project with a `.js` (or `.ts`, etc.) extension in its name.

### 2f9e553892085bd6e0eb9bc22a3a8dd8206e7083 chore(release): 0.1.0-alpha.6

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.6`. It contains no code changes.

**Action:** No action needed.

### fc63819b80b66ec0f7739d83fbb1868e5563fd0d fix: Support packages with only node import condition and no workerd condition (#510)

**Analysis:** This commit adds `"node"` as a fallback import condition for the `ssr` and `worker` environments. This improves compatibility with npm packages that are designed for Cloudflare Workers but have dependencies that only provide a `"node"` export condition. This allows Vite to resolve these modules correctly, although it introduces a small risk of importing Node.js-specific packages that are not compatible with the Workers runtime.

**Behaviors to test:**

-   A project can successfully import and use a dependency from `node_modules` that only specifies a `"node"` export condition in its `package.json`.

### 668a5685496adf93720cfca5a5c1bfe04364bdea chore(release): 0.1.0-alpha.7

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.7`. It contains no code changes.

**Action:** No action needed.

### e4f7587dd8fb90ca64df4fe4f9e9e7b81a34c118 fix: Also look for *.tsx in directive transformation during optimizeDeps (#511)

**Analysis:** This commit fixes a bug where the esbuild plugin used during Vite's `optimizeDeps` step was only processing `.js` files for directive transformations. This meant that `"use client"` and `"use server"` directives in `.ts` or `.tsx` files were being ignored by the dependency scanner, which could lead to incorrect dependencies being associated with the worker environment. The fix updates the plugin's file filter to include all relevant TypeScript and JSX file extensions.

**Behaviors to test:**

-   A `"use client"` component in a `.tsx` file that imports a client-side-only dependency should build and run correctly, without the client-side dependency being incorrectly bundled into the worker environment.

### 3973132b374e3fa96faaf22b12e59a79758be959 chore(release): 0.1.0-alpha.8

**Analysis:** This is a release commit that bumps the version to `0.1.0-alpha.8`. It contains no code changes.

**Action:** No action needed.

### 7e3cdecb9bf82bf5315f969093a888704d3a6bdb Feat: Typesafe ctx

**Analysis:** This commit introduces a major developer experience improvement by making the request context (`requestInfo.ctx`) typesafe. It uses generics throughout the routing system, allowing developers to define a custom type for their application's context. This custom context can be populated in middleware and then accessed in a typesafe way in subsequent middleware, route handlers, and layouts.

**Behaviors to test:**

-   A middleware can add custom, typed properties to the `ctx` object.
-   A route handler receives and can access the typed context populated by a preceding middleware.
-   A layout component receives and can access the typed context.
-   An end-to-end flow where a value is set in a middleware's context and then rendered on a page demonstrates that the context is passed correctly through the system.

### e3d132338c92a95c9a7522ff6b7d27e79393ff8c chore(release): 0.1.0-alpha.9

**Analysis:** Could not analyze this commit. The git object appears to be corrupted or missing.

**Action:** Skipping.

### 47c92a543666b6c0384dc137c093a8936dd3c9bd fix: Forward `rw` prop in Document (#516)

**Analysis:** Could not analyze this commit. The git object appears to be corrupted or missing.

**Action:** Skipping.

### 23f5383a1529124237f005f778a0d9e334d7d91a chore(release): 0.1.0-alpha.10

**Analysis:** Could not analyze this commit. The git object appears to be corrupted or missing. This is the third consecutive commit with this issue.

**Action:** Halting analysis due to repository issues.

### 4e747d174301d0a5e87a20c3260c6d9101d24a35 fix: Always add default rw transform plugin (#519)