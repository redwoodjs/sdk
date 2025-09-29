### PR #708 - feat(deps): Switch to peer dependency model for React
https://github.com/redwoodjs/sdk/pull/708
Author: @justinvdm  Merged: 2025-09-11T12:42:12Z

## Problem

The SDK previously managed `react`, `@cloudflare/vite-plugin`, and `wrangler` as direct or optional dependencies. This model had several consequences:
- It did not expose the specific dependency versions in the user's `package.json`, which limited control over these packages.
- It could lead to version mismatches or conflicts with other libraries in a user's project.
- It caused runtime errors in certain environments. For instance, recent React canary releases use `WeakRef`, which is unsupported in older Cloudflare Workers runtimes. Because the SDK managed the Cloudflare tooling versions, users could not directly upgrade their environment to resolve the `ReferenceError: WeakRef is not defined` error.

## Solution 

This change transitions the SDK to a peer dependency model for its core tooling. The `react`, `react-dom`, `react-server-dom-webpack`, `@cloudflare/vite-plugin`, and `wrangler` packages are now declared as `peerDependencies`.

This delegates the responsibility of providing these dependencies to the user's project, which allows a single, user-controlled version is used throughout the application. The starter projects have been updated to include these packages as explicit dependencies, along with an updated `compatibility_date` in `wrangler.jsonc` that enables support for features like `WeakRef` by default.

---

## BREAKING CHANGES & MIGRATION GUIDE

**1. Add Core Dependencies**

Your project's `package.json` must now include explicit dependencies for React and the Cloudflare toolchain. Add the following to your `dependencies` and `devDependencies`:

```json
// package.json

"dependencies": {
  // ... your other dependencies
  "react": "19.2.0-canary-3fb190f7-20250908",
  "react-dom": "19.2.0-canary-3fb190f7-20250908",
  "react-server-dom-webpack": "19.2.0-canary-3fb190f7-20250908"
},
"devDependencies": {
  // ... your other devDependencies
  "@cloudflare/vite-plugin": "1.12.4",
  "wrangler": "4.35.0"
}
```

**2. Update Wrangler Configuration**

To ensure the Cloudflare Workers runtime supports the features required by modern React, update your `wrangler.jsonc` (or `wrangler.toml`):

-   Set the `compatibility_date` to `2025-08-21` or later.

```json
// wrangler.jsonc

{
  // ...
  "compatibility_date": "2025-08-21",
  // ...
}
```

After making these changes, run your package manager's install command (e.g., `pnpm install`) to apply the updates.

---

### PR #715 - fix: Unify request handling for pages and RSC actions
https://github.com/redwoodjs/sdk/pull/715
Author: @justinvdm  Merged: 2025-09-11T12:02:01Z

### Problem

Previously, RSC action requests bypassed the middleware pipeline and were handled directly. This created an inconsistency where logic defined in middleware (e.g. session validation, authentication checks, setting security headers) was not applied to action requests. This could lead to security vulnerabilities and required developers to duplicate context-aware logic inside action handlers.

### Solution

The router's `handle` method has been restructured into a deterministic, three-stage pipeline that processes all incoming requests:

1.  **Global Middleware Execution**: All global middleware is executed in order.
2.  **RSC Action Handling**: If the request is an RSC action, the action handler is now invoked *after* all middleware has completed.
3.  **Page Route Matching**: The router proceeds to match the request to a page route for rendering.

### BREAKING CHANGE

React Server Component (RSC) actions now run through the global middleware pipeline. Previously, action requests bypassed all middleware.

This change allows logic for authentication, session handling, and security headers to apply consistently to all incoming requests. However, if you have existing middleware, it will now execute for RSC actions, which may introduce unintended side effects.

#### Migration Guide

You must review your existing global middleware to ensure it is compatible with RSC action requests. A new `isAction` boolean flag is now available on the `requestInfo` object passed to middleware, making it easy to conditionally apply logic.

If you have middleware that should only run for page requests, you need to add a condition to bypass its logic for action requests.

**Example:**

Let's say you have a middleware that logs all incoming page requests. You would modify it to exclude actions like so:

```typescript
// src/worker.tsx

const loggingMiddleware = ({ isAction, request }) => {
  // Check if the request is for an RSC action.
  if (isAction) {
    // It's an action, so we skip the logging logic.
    return;
  }

  // Otherwise, it's a page request, so we log it.
  const url = new URL(request.url);
  console.log('Page requested:', url.pathname);
};

export default defineApp([
  loggingMiddleware,
  // ... your other middleware and routes
]);
```

---

### PR #720 - feat: Upgrade to Vite v7
https://github.com/redwoodjs/sdk/pull/720
Author: @justinvdm  Merged: 2025-09-11T16:04:53Z

Upgrades starter projects to Vite v7 and widens the SDK's `peerDependency` range to maintain compatibility.

Fixes #692 

---

### PR #721 - tests: Add more unit tests
https://github.com/redwoodjs/sdk/pull/721
Author: @justinvdm  Merged: 2025-09-15T02:57:10Z



---

### PR #722 - chore: Use npm pack tarball of sdk for smoke tests
https://github.com/redwoodjs/sdk/pull/722
Author: @justinvdm  Merged: 2025-09-15T03:24:12Z

### Problem

Previously, our smoke tests "synced" local SDK source code instead of performing a true package installation. This approach could not detect critical issues like peer dependency conflicts, which only appear during a clean install from a package.

### Solution

The new process, encapsulated in the `sdk/scripts/ci-smoke-test.sh` script, now builds the SDK and packs it into a tarball. The tests then install this tarball into an isolated starter project. This change ensures we are validating the exact package that users would receive. The rationale is now documented in `docs/architecture/smokeTesting-strategy.md`.

---

### PR #724 - 📝 Updates to the Jobs Form page (tutorial)
https://github.com/redwoodjs/sdk/pull/724
Author: @ahaywood  Merged: 2025-09-12T21:06:17Z



---

### PR #727 - 📝 Updated the Contacts section of the tutorial
https://github.com/redwoodjs/sdk/pull/727
Author: @ahaywood  Merged: 2025-09-13T21:29:58Z



---

### PR #728 - ✨ Added a favicon to the minimal and standard starter
https://github.com/redwoodjs/sdk/pull/728
Author: @ahaywood  Merged: 2025-09-15T02:49:57Z

### Before
Before, we didn't have a favicon at all

<img width="281" height="51" alt="CleanShot 2025-09-13 at 16 45 49" src="https://github.com/user-attachments/assets/870d4399-4475-4cf7-80fb-9dcfad3e82b2" />

### After

This PR adds a light favicon
<img width="293" height="53" alt="CleanShot 2025-09-13 at 16 43 46" src="https://github.com/user-attachments/assets/f8f30a81-0784-44ea-af92-3e1fb5537901" />

and a dark favicon
<img width="293" height="53" alt="CleanShot 2025-09-13 at 16 44 03" src="https://github.com/user-attachments/assets/dc61cfcb-ea04-4313-b230-4264ed6a7db4" />

This will conditionally display, depending on the user's system preferences

### Additional Considerations

This favicon utilizes green and teal colors. The reason that it's not the "standard" brand colors is because our the RWSDK site and our docs both utilize reds and oranges:

<img width="284" height="80" alt="CleanShot 2025-09-13 at 16 44 57" src="https://github.com/user-attachments/assets/bc261130-b75d-40a4-8ed6-cc8058858fe8" />

So, if the user has all 3 of the sites open during development, it can become difficult to visually differentiate these sites.
 

---

### PR #729 - fix: Update starter worker types
https://github.com/redwoodjs/sdk/pull/729
Author: @justinvdm  Merged: 2025-09-15T02:41:13Z

Now that we are pinning deps for our starters, our CF worker types defs need to be newer versions to be compatible with the wrangler version we have pinned.

---

### PR #731 - Finished making updates to the Jobs Details page of the tutorial
https://github.com/redwoodjs/sdk/pull/731
Author: @ahaywood  Merged: 2025-09-15T03:47:25Z



---

### PR #732 - fix: Avoid duplicate identifiers in build during linking
https://github.com/redwoodjs/sdk/pull/732
Author: @justinvdm  Merged: 2025-09-15T12:06:35Z

## The Problem: Duplicate Identifier Collision

Our multi-phase build process ends with a linker pass where the main `worker` bundle is combined with a separately-built `ssr` bundle. Both of these are pre-compiled and minified artifacts. During this final step, Vite's `esbuild-transpile` plugin would fail with a `duplicate identifier` error (e.g., `The symbol "l0" has already been declared`).

The root cause is how Rollup merges modules. When combining the two pre-bundled artifacts, it places them in a shared top-level scope. Because both bundles were independently minified, they could contain identical, short variable names (`l0`), leading to a redeclaration error. The bundler cannot safely rename these identifiers because the semantic context of the original source code is lost in a pre-compiled artifact.

## The Solution: Scope Isolation via Exporting IIFE

The solution is to modify how the `ssr` bundle is generated, making it a "good citizen" that can be safely imported by another bundle.

We've updated the SSR build configuration to wrap its entire output in an exporting Immediately Invoked Function Expression (IIFE). This is achieved using Rollup's `banner` and `footer` options, combined with a small inline plugin to remove the original `export` statement from the bundle's content.

The resulting artifact is a valid, tree-shakeable ES module that exports its members from an isolated scope. This prevents any internal variable names from colliding with the parent `worker` bundle, resolving the build failure while preserving the benefits of static analysis.

---

### PR #734 - fix: Correct vendor module paths in dev directive barrel file
https://github.com/redwoodjs/sdk/pull/734
Author: @justinvdm  Merged: 2025-09-17T03:57:39Z

To improve development server performance and stability, we use a pre-scanning step that consolidates all dependencies into virtual "barrel files" which are then passed to Vite's dependency optimizer. This process (see [Dev Server Dependency Optimization](./docs/architecture/devServerDependencyOptimization.md) architecture document), ensures the entire dependency graph is understood at startup, preventing both request waterfalls and disruptive mid-session re-optimizations.

A recent refactoring, intended to add unit tests, inadvertently introduced a logic change in how the module paths were generated within these barrel files. The change incorrectly removed the leading forward slash from the paths of vendor modules (e.g., `/node_modules/lib/index.js` became `node_modules/lib/index.js`).

This change resulted in invalid, non-resolvable paths. When a page that relied on one of these vendor modules was rendered, the SSR runtime was unable to locate the module, causing a `TypeError`.

This fix restores the leading forward slash to the module paths in the generated barrel file, ensuring they are valid and correctly resolved by the development server.

---

### PR #738 - fix: Restore short-circuiting behavior for routes
https://github.com/redwoodjs/sdk/pull/738
Author: @justinvdm  Merged: 2025-09-17T14:33:06Z

### Problem

A recent PR (https://github.com/redwoodjs/sdk/pull/715) correctly routed RSC actions through the middleware pipeline by changing the router's request handling from a single, short-circuiting loop to a multi-stage pipeline. The stages were:

1.  Execute all global middleware
2.  Handle RSC actions
3.  Match and render the page route

The problem was that step 1 executed *all* global middleware from the entire route list on *every* request. Since the `render()` function works by adding a configuration middleware (e.g., to set `ssr: false`), this meant the configuration from the last `render()` block in `worker.tsx` would overwrite any previously applied settings, regardless of which route was actually matched.

### Solution

This PR replaces the multi-stage pipeline with a unified, single-pass processing loop that restores the original short-circuiting behavior. The new logic is as follows:

1.  **Unified Loop:** The router iterates through all routes (middleware and page routes) in the order they are defined.
2.  **Short-Circuiting:** If any middleware returns a `Response` or a JSX element, processing stops immediately, and that response is returned.
3.  **Correct RSC Action Handling:** The RSC action handler is now invoked just before the *first* page route definition is evaluated. This ensures all global middleware has run, but it happens only once at the correct time.

This approach ensures that only the middleware relevant to the matched route is ever executed, fixing the configuration override bug while preserving the necessary RSC action handling.

We now also have a test suite for our router API to prevent future regressions like this.

---

### PR #745 - fix: Use permissive range for React peer dependencies
https://github.com/redwoodjs/sdk/pull/745
Author: @justinvdm  Merged: 2025-09-18T16:21:14Z

### Problem

The `peerDependencies` for React packages (`react`, `react-dom`, `react-server-dom-webpack`) were pinned to an exact canary version. This caused `npm install` to fail with an `ERESOLVE` error when downstream projects (like our starters) attempted to install a newer canary version.

### Solution

This change updates the version specifiers for the React peer dependencies to any versions within `19.2.0-canary-3fb190f7-20250908 <20.0.0`

---

### PR #746 - fix(deps): update starter-peer-deps
https://github.com/redwoodjs/sdk/pull/746
Author: @app/renovate  Merged: 2025-09-22T16:03:28Z

## Manual Changes and Fixes

#### Vite Upgrade (`7.1.5` -> `7.1.6`) and Directive Scanner Failures

**Problem**

We have a custom directive scanner that discovers `"use client"` and `"use server"` files. To minimize user dependencies and ensure consistent behavior, this scanner relies on the `esbuild` binary that ships with Vite.

The upgrade to Vite `7.1.6` introduced a breaking change via its internal `esbuild` dependency, which was updated from `^0.23.0` to `^0.24.0`. The new `esbuild` version changed its API behavior, making it an error to use `write: false` with `bundle: true` for multiple entry points without specifying an `outdir`. This caused our directive scanner to fail. A follow-up issue also occurred where the scanner failed on virtual modules provided by Vite's config.

**Solution**

The scanner's `esbuild` configuration was updated to be compatible with the new API. This involved two changes:
1.  Adding a temporary `outdir` to the configuration. Since `write: false` is still set, no files are written to disk.
2.  Adding a filter to ignore virtual modules (e.g., `virtual:cloudflare/worker-entry`) before passing entry points to `esbuild`.

---

#### `@cloudflare/vite-plugin` (`1.12.4` -> `1.13.3`) and Build Process Conflict

**Problem**

Our production build is a multi-pass process orchestrated by `buildApp.mts`. It first builds an intermediate worker bundle, then "links" it with an SSR bridge to produce the final single-file artifact. This process must work in harmony with the Cloudflare plugin.

The updated `@cloudflare/vite-plugin` now requires the main worker entry chunk to be named `index`. This requires a Rollup input config like `{ index: '...' }`. However, to create a single-file worker bundle, we need `inlineDynamicImports: true`, and a recent Rollup update requires this option to be used with a simple string input, not an object. This created a deadlock, preventing a successful build.

**Solution**

The solution was to adapt our build process to cooperate with the plugin:
1.  The manual `rollupOptions` for the worker build were removed from our `configPlugin.mts`, allowing the `@cloudflare/vite-plugin` to take control and generate a valid intermediate build with an `index.js` chunk.
2.  The "linker" pass in `buildApp.mts` was updated to hook into the plugin-generated configuration. It now modifies the existing config, re-pointing the `input` to the intermediate `index.js` artifact from the first pass.

This resolves the conflict by letting the plugin manage the build while still allowing our orchestrator to perform its essential multi-pass logic.

---

#### Dev Server Directive Scan Regression

**Problem**

The fix for the production build involved removing the manual `rollupOptions` from the worker's Vite configuration, allowing the Cloudflare plugin to manage the build. This change, while correct for production, had an unintended side-effect on the development server. The dev server failed because the directive scanner, which runs on startup, no longer had an entry point. It relied on the `rollupOptions` that had been removed, and it was executing before the full Vite configuration for the worker environment was resolved.

**Solution**

The dependency on the implicit Vite configuration was removed. The `runDirectivesScan` function was updated to accept an explicit `entries` parameter. This entry point is now passed directly from the main `redwoodPlugin` (for the `dev` command) and the `buildApp` function (for the `build` command), ensuring the scanner always has the correct starting point.

---

#### CI Infrastructure Changes: Switching to Tarball-Based Testing

**Problem**

The investigation into the build failures revealed that the existing CI setup, which relied on workspace linking, was running tests against stale dependencies from the monorepo's `node_modules`. This meant the CI was not testing against the newly upgraded package versions, which hid the build and type errors.

**Solution**

To ensure the CI accurately validates the project against the upgraded dependencies, the test environments for both smoke tests and E2E tests were switched to use a tarball-based installation. This process involves:
1.  Packing the SDK into a tarball.
2.  Copying the test project (e.g., a starter or playground app) to a clean, temporary directory.
3.  Installing dependencies in the isolated environment using the SDK tarball.

This approach guarantees that tests run in a clean environment with the correct, newly-updated dependencies, accurately simulating a real user installation. As part of this change, the redundant `check-starters.yml` workflow was removed, as its type-checking coverage is now handled more reliably by the playground E2E tests.


## Automated changes
This PR contains the following updates:

| Package | Change | Age | Confidence |
|---|---|---|---|
| [@cloudflare/vite-plugin](https://redirect.github.com/cloudflare/workers-sdk/tree/main/packages/vite-plugin-cloudflare#readme) ([source](https://redirect.github.com/cloudflare/workers-sdk/tree/HEAD/packages/vite-plugin-cloudflare)) | [`1.12.4` -> `1.13.3`](https://renovatebot.com/diffs/npm/@cloudflare%2fvite-plugin/1.12.4/1.13.3) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@cloudflare%2fvite-plugin/1.13.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@cloudflare%2fvite-plugin/1.12.4/1.13.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@cloudflare/workers-types](https://redirect.github.com/cloudflare/workerd) | [`4.20250913.0` -> `4.20250921.0`](https://renovatebot.com/diffs/npm/@cloudflare%2fworkers-types/4.20250913.0/4.20250921.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@cloudflare%2fworkers-types/4.20250921.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@cloudflare%2fworkers-types/4.20250913.0/4.20250921.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [react](https://react.dev/) ([source](https://redirect.github.com/facebook/react/tree/HEAD/packages/react)) | [`19.2.0-canary-3fb190f7-20250908` -> `19.2.0-canary-d415fd3e-20250919`](https://renovatebot.com/diffs/npm/react/19.2.0-canary-3fb190f7-20250908/19.2.0-canary-d415fd3e-20250919) | [![age](https://developer.mend.io/api/mc/badges/age/npm/react/19.2.0-canary-d415fd3e-20250919?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/react/19.2.0-canary-3fb190f7-20250908/19.2.0-canary-d415fd3e-20250919?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [react-dom](https://react.dev/) ([source](https://redirect.github.com/facebook/react/tree/HEAD/packages/react-dom)) | [`19.2.0-canary-3fb190f7-20250908` -> `19.2.0-canary-d415fd3e-20250919`](https://renovatebot.com/diffs/npm/react-dom/19.2.0-canary-3fb190f7-20250908/19.2.0-canary-d415fd3e-20250919) | [![age](https://developer.mend.io/api/mc/badges/age/npm/react-dom/19.2.0-canary-d415fd3e-20250919?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/react-dom/19.2.0-canary-3fb190f7-20250908/19.2.0-canary-d415fd3e-20250919?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [react-server-dom-webpack](https://react.dev/) ([source](https://redirect.github.com/facebook/react/tree/HEAD/packages/react-server-dom-webpack)) | [`19.2.0-canary-3fb190f7-20250908` -> `19.2.0-canary-d415fd3e-20250919`](https://renovatebot.com/diffs/npm/react-server-dom-webpack/19.2.0-canary-3fb190f7-20250908/19.2.0-canary-d415fd3e-20250919) | [![age](https://developer.mend.io/api/mc/badges/age/npm/react-server-dom-webpack/19.2.0-canary-d415fd3e-20250919?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/react-server-dom-webpack/19.2.0-canary-3fb190f7-20250908/19.2.0-canary-d415fd3e-20250919?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [vite](https://vite.dev) ([source](https://redirect.github.com/vitejs/vite/tree/HEAD/packages/vite)) | [`7.1.5` -> `7.1.6`](https://renovatebot.com/diffs/npm/vite/7.1.5/7.1.6) | [![age](https://developer.mend.io/api/mc/badges/age/npm/vite/7.1.6?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vite/7.1.5/7.1.6?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [wrangler](https://redirect.github.com/cloudflare/workers-sdk) ([source](https://redirect.github.com/cloudflare/workers-sdk/tree/HEAD/packages/wrangler)) | [`4.35.0` -> `4.38.0`](https://renovatebot.com/diffs/npm/wrangler/4.35.0/4.38.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/wrangler/4.38.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/wrangler/4.35.0/4.38.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |

---

> [!WARNING]
> Some dependencies could not be looked up. Check the Dependency Dashboard for more information.

This PR updates the following dependencies:

---

### Release Notes

<details>
<summary>cloudflare/workers-sdk (@&#8203;cloudflare/vite-plugin)</summary>

### [`v1.13.3`](https://redirect.github.com/cloudflare/workers-sdk/blob/HEAD/packages/vite-plugin-cloudflare/CHANGELOG.md#1133)

[Compare Source](https://redirect.github.com/cloudflare/workers-sdk/compare/@cloudflare/vite-plugin@1.13.2...@cloudflare/vite-plugin@1.13.3)

##### Patch Changes

- [#&#8203;10664](https://redirect.github.com/cloudflare/workers-sdk/pull/10664) [`924fdde`](https://redirect.github.com/cloudflare/workers-sdk/commit/924fdde4c36cd58de713ec9eaf2c983fa6bd6b22) Thanks [@&#8203;jamesopstad](https://redirect.github.com/jamesopstad)! - Avoid mutating the Worker config during build.

- Updated dependencies \[[`b59e3e1`](https://redirect.github.com/cloudflare/workers-sdk/commit/b59e3e165d2a349399a6658c89419cb6aa89c713), [`a4e2439`](https://redirect.github.com/cloudflare/workers-sdk/commit/a4e243936744e9960f2e5006a2c0e2820c6333af), [`1cc258e`](https://redirect.github.com/cloudflare/workers-sdk/commit/1cc258e2fdf56e38c37b3cf36d6e279edc90ea2d), [`f76da43`](https://redirect.github.com/cloudflare/workers-sdk/commit/f76da43cc8f5f2a12fa15ba1db4ce5b3de84f33b), [`b30263e`](https://redirect.github.com/cloudflare/workers-sdk/commit/b30263ea2d0b608640f181ba84b46c27b14bfcaf), [`b30263e`](https://redirect.github.com/cloudflare/workers-sdk/commit/b30263ea2d0b608640f181ba84b46c27b14bfcaf), [`769ffb1`](https://redirect.github.com/cloudflare/workers-sdk/commit/769ffb190e69a759322612700677c770c8c54c09), [`e9b0c66`](https://redirect.github.com/cloudflare/workers-sdk/commit/e9b0c665aea3c12103ebc2d1070d7e05ff0bfe46), [`6caf938`](https://redirect.github.com/cloudflare/workers-sdk/commit/6caf938fe989ee7c261b330560982311b93e0438), [`88132bc`](https://redirect.github.com/cloudflare/workers-sdk/commit/88132bc25c45257d8a38c25bef3b9c4761a2903e)]:
  - miniflare\@&#8203;4.20250917.0
  - wrangler\@&#8203;4.38.0
  - [@&#8203;cloudflare/unenv-preset](https://redirect.github.com/cloudflare/unenv-preset)@&#8203;2.7.4

### [`v1.13.2`](https://redirect.github.com/cloudflare/workers-sdk/blob/HEAD/packages/vite-plugin-cloudflare/CHANGELOG.md#1132)

[Compare Source](https://redirect.github.com/cloudflare/workers-sdk/compare/@cloudflare/vite-plugin@1.13.1...@cloudflare/vite-plugin@1.13.2)

##### Patch Changes

- [#&#8203;10632](https://redirect.github.com/cloudflare/workers-sdk/pull/10632) [`60631d5`](https://redirect.github.com/cloudflare/workers-sdk/commit/60631d5ab443e5694037687e591bb6d38447c128) Thanks [@&#8203;jamesopstad](https://redirect.github.com/jamesopstad)! - Ensure that correct error messages and stack traces are displayed.

- Updated dependencies \[[`3029b9a`](https://redirect.github.com/cloudflare/workers-sdk/commit/3029b9a9734edd52b7d83f91d56abbbd8ad9ae81), [`783afeb`](https://redirect.github.com/cloudflare/workers-sdk/commit/783afeb90f32c9e2c0a96f83ccff30ad7155e419), [`31ec996`](https://redirect.github.com/cloudflare/workers-sdk/commit/31ec996d39713c9d25da60122edc9e41aec1a90b)]:
  - wrangler\@&#8203;4.37.1
  - miniflare\@&#8203;4.20250913.0

### [`v1.13.1`](https://redirect.github.com/cloudflare/workers-sdk/blob/HEAD/packages/vite-plugin-cloudflare/CHANGELOG.md#1131)

[Compare Source](https://redirect.github.com/cloudflare/workers-sdk/compare/@cloudflare/vite-plugin@1.13.0...@cloudflare/vite-plugin@1.13.1)

##### Patch Changes

- Updated dependencies \[[`d53a0bc`](https://redirect.github.com/cloudflare/workers-sdk/commit/d53a0bc3afee011cc9edbb61d1583f61a986831f), [`735785e`](https://redirect.github.com/cloudflare/workers-sdk/commit/735785e7948da06411b738c70efcd95626efb3eb), [`15c34e2`](https://redirect.github.com/cloudflare/workers-sdk/commit/15c34e23d6bcd225a3ebea08cba25d3c62b77729)]:
  - wrangler\@&#8203;4.37.0
  - miniflare\@&#8203;4.20250906.2

### [`v1.13.0`](https://redirect.github.com/cloudflare/workers-sdk/blob/HEAD/packages/vite-plugin-cloudflare/CHANGELOG.md#1130)

[Compare Source](https://redirect.github.com/cloudflare/workers-sdk/compare/@cloudflare/vite-plugin@1.12.4...@cloudflare/vite-plugin@1.13.0)

##### Minor Changes

- [#&#8203;10212](https://redirect.github.com/cloudflare/workers-sdk/pull/10212) [`0837a8d`](https://redirect.github.com/cloudflare/workers-sdk/commit/0837a8d4e406809e388dc06ad0b26a77b350f7b4) Thanks [@&#8203;jamesopstad](https://redirect.github.com/jamesopstad)! - Support packages and virtual modules in the `main` field of the Worker config. The primary use case is to enable users to directly provide a file exported by a framework as the Worker entry module.

- [#&#8203;10604](https://redirect.github.com/cloudflare/workers-sdk/pull/10604) [`135e066`](https://redirect.github.com/cloudflare/workers-sdk/commit/135e06658ad3e3bd1d255c412597ce761ea412cb) Thanks [@&#8203;penalosa](https://redirect.github.com/penalosa)! - Enable Remote Bindings without the need for the `experimental: { remoteBindings: true }` property

##### Patch Changes

- Updated dependencies \[[`0837a8d`](https://redirect.github.com/cloudflare/workers-sdk/commit/0837a8d4e406809e388dc06ad0b26a77b350f7b4), [`da24079`](https://redirect.github.com/cloudflare/workers-sdk/commit/da24079b370ad2af4e97b41ab20ad474ab148ead), [`ffa2600`](https://redirect.github.com/cloudflare/workers-sdk/commit/ffa2600a656b7a07cab622ea67338e770fd33bc3), [`135e066`](https://redirect.github.com/cloudflare/workers-sdk/commit/135e06658ad3e3bd1d255c412597ce761ea412cb), [`e2b838f`](https://redirect.github.com/cloudflare/workers-sdk/commit/e2b838ff56572d581661143d56f2485d7bcf1e0e), [`30f558e`](https://redirect.github.com/cloudflare/workers-sdk/commit/30f558eb4a02dcc5125f216d6fbe1d0be3b6d08f), [`d8860ac`](https://redirect.github.com/cloudflare/workers-sdk/commit/d8860ac17b20be71e1069d90861e3c49a6d5247b), [`336a75d`](https://redirect.github.com/cloudflare/workers-sdk/commit/336a75d8d7c52cc24e08de62dd4306201b879932), [`51553ef`](https://redirect.github.com/cloudflare/workers-sdk/commit/51553efa5bd7f07aa20d38fe6db62aa61e2b1999)]:
  - wrangler\@&#8203;4.36.0
  - miniflare\@&#8203;4.20250906.1

</details>

<details>
<summary>cloudflare/workerd (@&#8203;cloudflare/workers-types)</summary>

### [`v4.20250921.0`](https://redirect.github.com/cloudflare/workerd/compare/c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6...1db98ae93ad97c00283e87bbeb14c93f10c1dae6)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6...1db98ae93ad97c00283e87bbeb14c93f10c1dae6)

### [`v4.20250920.0`](https://redirect.github.com/cloudflare/workerd/compare/7b6621d94ced05981d04b88f894ba617985e086c...c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/7b6621d94ced05981d04b88f894ba617985e086c...c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6)

### [`v4.20250919.0`](https://redirect.github.com/cloudflare/workerd/compare/f0c91b22361c02328bfdf5053c5380598f26f67c...7b6621d94ced05981d04b88f894ba617985e086c)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/f0c91b22361c02328bfdf5053c5380598f26f67c...7b6621d94ced05981d04b88f894ba617985e086c)

### [`v4.20250918.0`](https://redirect.github.com/cloudflare/workerd/compare/84b597aca73b45f38a61c131f388ee26a64cf145...f0c91b22361c02328bfdf5053c5380598f26f67c)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/84b597aca73b45f38a61c131f388ee26a64cf145...f0c91b22361c02328bfdf5053c5380598f26f67c)

### [`v4.20250917.0`](https://redirect.github.com/cloudflare/workerd/compare/182098fbaa2df43c2ae0299affa9ce68fe007b89...84b597aca73b45f38a61c131f388ee26a64cf145)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/182098fbaa2df43c2ae0299affa9ce68fe007b89...84b597aca73b45f38a61c131f388ee26a64cf145)

</details>

<details>
<summary>facebook/react (react)</summary>

### [`v19.2.0-canary-d415fd3e-20250919`](https://redirect.github.com/facebook/react/compare/cee7939b0017ff58230e19663c22393bfd9025ef...d415fd3ed716f02f463232341ab21e909e0058ca)

[Compare Source](https://redirect.github.com/facebook/react/compare/cee7939b0017ff58230e19663c22393bfd9025ef...d415fd3ed716f02f463232341ab21e909e0058ca)

### [`v19.2.0-canary-cee7939b-20250625`](https://redirect.github.com/facebook/react/compare/c498bfce8b9baa3dd21bd0d5124eb3a4549886f1...cee7939b0017ff58230e19663c22393bfd9025ef)

[Compare Source](https://redirect.github.com/facebook/react/compare/c498bfce8b9baa3dd21bd0d5124eb3a4549886f1...cee7939b0017ff58230e19663c22393bfd9025ef)

### [`v19.2.0-canary-c498bfce-20250426`](https://redirect.github.com/facebook/react/compare/c4676e72a630f3e93634c2b004b3be07b17a79c8...c498bfce8b9baa3dd21bd0d5124eb3a4549886f1)

[Compare Source](https://redirect.github.com/facebook/react/compare/c4676e72a630f3e93634c2b004b3be07b17a79c8...c498bfce8b9baa3dd21bd0d5124eb3a4549886f1)

### [`v19.2.0-canary-c4676e72-20250520`](https://redirect.github.com/facebook/react/compare/c44e4a250557e53b120e40db8b01fb5fd93f1e35...c4676e72a630f3e93634c2b004b3be07b17a79c8)

[Compare Source](https://redirect.github.com/facebook/react/compare/c44e4a250557e53b120e40db8b01fb5fd93f1e35...c4676e72a630f3e93634c2b004b3be07b17a79c8)

### [`v19.2.0-canary-c44e4a25-20250409`](https://redirect.github.com/facebook/react/compare/c260b38d0a082641342fc45ff5ac96e32f764f20...c44e4a250557e53b120e40db8b01fb5fd93f1e35)

[Compare Source](https://redirect.github.com/facebook/react/compare/c260b38d0a082641342fc45ff5ac96e32f764f20...c44e4a250557e53b120e40db8b01fb5fd93f1e35)

### [`v19.2.0-canary-c260b38d-20250731`](https://redirect.github.com/facebook/react/compare/c129c2424b662a371865a0145c562a1cf934b023...c260b38d0a082641342fc45ff5ac96e32f764f20)

[Compare Source](https://redirect.github.com/facebook/react/compare/c129c2424b662a371865a0145c562a1cf934b023...c260b38d0a082641342fc45ff5ac96e32f764f20)

### [`v19.2.0-canary-c129c242-20250505`](https://redirect.github.com/facebook/react/compare/c0464aedb16b1c970d717651bba8d1c66c578729...c129c2424b662a371865a0145c562a1cf934b023)

[Compare Source](https://redirect.github.com/facebook/react/compare/c0464aedb16b1c970d717651bba8d1c66c578729...c129c2424b662a371865a0145c562a1cf934b023)

### [`v19.2.0-canary-c0464aed-20250523`](https://redirect.github.com/facebook/react/compare/befc1246b07a04b401bc6e914b7f336a442dca1a...c0464aedb16b1c970d717651bba8d1c66c578729)

[Compare Source](https://redirect.github.com/facebook/react/compare/befc1246b07a04b401bc6e914b7f336a442dca1a...c0464aedb16b1c970d717651bba8d1c66c578729)

### [`v19.2.0-canary-befc1246-20250708`](https://redirect.github.com/facebook/react/compare/be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14...befc1246b07a04b401bc6e914b7f336a442dca1a)

[Compare Source](https://redirect.github.com/facebook/react/compare/be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14...befc1246b07a04b401bc6e914b7f336a442dca1a)

### [`v19.2.0-canary-be11cb5c-20250804`](https://redirect.github.com/facebook/react/compare/bdb4a96f628d3b426d3c79fbd598ec35c05835a3...be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14)

[Compare Source](https://redirect.github.com/facebook/react/compare/bdb4a96f628d3b426d3c79fbd598ec35c05835a3...be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14)

### [`v19.2.0-canary-bdb4a96f-20250801`](https://redirect.github.com/facebook/react/compare/bc6184dd993e6ea0efdee7553293676db774c3ca...bdb4a96f628d3b426d3c79fbd598ec35c05835a3)

[Compare Source](https://redirect.github.com/facebook/react/compare/bc6184dd993e6ea0efdee7553293676db774c3ca...bdb4a96f628d3b426d3c79fbd598ec35c05835a3)

### [`v19.2.0-canary-bc6184dd-20250417`](https://redirect.github.com/facebook/react/compare/bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36...bc6184dd993e6ea0efdee7553293676db774c3ca)

[Compare Source](https://redirect.github.com/facebook/react/compare/bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36...bc6184dd993e6ea0efdee7553293676db774c3ca)

### [`v19.2.0-canary-bbc13fa1-20250624`](https://redirect.github.com/facebook/react/compare/bb6f0c8d2f29754347db0ff28186dc89c128b6ca...bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36)

[Compare Source](https://redirect.github.com/facebook/react/compare/bb6f0c8d2f29754347db0ff28186dc89c128b6ca...bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36)

### [`v19.2.0-canary-bb6f0c8d-20250901`](https://redirect.github.com/facebook/react/compare/edf550b67936f2c62534ad5549bf580a4f581bd8...bb6f0c8d2f29754347db0ff28186dc89c128b6ca)

[Compare Source](https://redirect.github.com/facebook/react/compare/edf550b67936f2c62534ad5549bf580a4f581bd8...bb6f0c8d2f29754347db0ff28186dc89c128b6ca)

### [`v19.2.0-canary-b9cfa0d3-20250505`](https://redirect.github.com/facebook/react/compare/b9a045368bc1186fcaff6e8b027cfca28c857f04...edf550b67936f2c62534ad5549bf580a4f581bd8)

[Compare Source](https://redirect.github.com/facebook/react/compare/b9a045368bc1186fcaff6e8b027cfca28c857f04...edf550b67936f2c62534ad5549bf580a4f581bd8)

### [`v19.2.0-canary-b9a04536-20250904`](https://redirect.github.com/facebook/react/compare/b94603b95504130aec72f61e02d7b66d48f33653...b9a045368bc1186fcaff6e8b027cfca28c857f04)

[Compare Source](https://redirect.github.com/facebook/react/compare/b94603b95504130aec72f61e02d7b66d48f33653...b9a045368bc1186fcaff6e8b027cfca28c857f04)

### [`v19.2.0-canary-b94603b9-20250513`](https://redirect.github.com/facebook/react/compare/b7e2de632b2a160bc09edda1fbb9b8f85a6914e8...b94603b95504130aec72f61e02d7b66d48f33653)

[Compare Source](https://redirect.github.com/facebook/react/compare/b7e2de632b2a160bc09edda1fbb9b8f85a6914e8...b94603b95504130aec72f61e02d7b66d48f33653)

### [`v19.2.0-canary-b7e2de63-20250611`](https://redirect.github.com/facebook/react/compare/b6c0aa88140bba2a61c1de16bda2505c89b26235...b7e2de632b2a160bc09edda1fbb9b8f85a6914e8)

[Compare Source](https://redirect.github.com/facebook/react/compare/b6c0aa88140bba2a61c1de16bda2505c89b26235...b7e2de632b2a160bc09edda1fbb9b8f85a6914e8)

### [`v19.2.0-canary-b6c0aa88-20250609`](https://redirect.github.com/facebook/react/compare/b4477d3800ccb0bdf26670cd1f021d094159c38f...b6c0aa88140bba2a61c1de16bda2505c89b26235)

[Compare Source](https://redirect.github.com/facebook/react/compare/b4477d3800ccb0bdf26670cd1f021d094159c38f...b6c0aa88140bba2a61c1de16bda2505c89b26235)

### [`v19.2.0-canary-b4477d38-20250605`](https://redirect.github.com/facebook/react/compare/b1b0955f2b34286a7408e58463f4cc429627f9a8...b4477d3800ccb0bdf26670cd1f021d094159c38f)

[Compare Source](https://redirect.github.com/facebook/react/compare/b1b0955f2b34286a7408e58463f4cc429627f9a8...b4477d3800ccb0bdf26670cd1f021d094159c38f)

### [`v19.2.0-canary-b1b0955f-20250901`](https://redirect.github.com/facebook/react/compare/b10cb4c01ec1ae41b67422239d919f261fefa7d1...b1b0955f2b34286a7408e58463f4cc429627f9a8)

[Compare Source](https://redirect.github.com/facebook/react/compare/b10cb4c01ec1ae41b67422239d919f261fefa7d1...b1b0955f2b34286a7408e58463f4cc429627f9a8)

### [`v19.2.0-canary-b10cb4c0-20250403`](https://redirect.github.com/facebook/react/compare/b07717d857422af5fb1c2ee0930e5a2a62df2b0e...b10cb4c01ec1ae41b67422239d919f261fefa7d1)

[Compare Source](https://redirect.github.com/facebook/react/compare/b07717d857422af5fb1c2ee0930e5a2a62df2b0e...b10cb4c01ec1ae41b67422239d919f261fefa7d1)

### [`v19.2.0-canary-b07717d8-20250528`](https://redirect.github.com/facebook/react/compare/b04254fdcee30871760301f34236ee0dfadf86ab...b07717d857422af5fb1c2ee0930e5a2a62df2b0e)

[Compare Source](https://redirect.github.com/facebook/react/compare/b04254fdcee30871760301f34236ee0dfadf86ab...b07717d857422af5fb1c2ee0930e5a2a62df2b0e)

### [`v19.2.0-canary-b04254fd-20250415`](https://redirect.github.com/facebook/react/compare/ac7820a99efac29dcd5a69f6d2438f6d31b7abbf...b04254fdcee30871760301f34236ee0dfadf86ab)

[Compare Source](https://redirect.github.com/facebook/react/compare/ac7820a99efac29dcd5a69f6d2438f6d31b7abbf...b04254fdcee30871760301f34236ee0dfadf86ab)

### [`v19.2.0-canary-ac7820a9-20250811`](https://redirect.github.com/facebook/react/compare/ab859e31be5db56106161060033109c9f2d26eca...ac7820a99efac29dcd5a69f6d2438f6d31b7abbf)

[Compare Source](https://redirect.github.com/facebook/react/compare/ab859e31be5db56106161060033109c9f2d26eca...ac7820a99efac29dcd5a69f6d2438f6d31b7abbf)

### [`v19.2.0-canary-ab859e31-20250606`](https://redirect.github.com/facebook/react/compare/aad7c664ffbde52e5d8004b542d83d6d4b7a32a0...ab859e31be5db56106161060033109c9f2d26eca)

[Compare Source](https://redirect.github.com/facebook/react/compare/aad7c664ffbde52e5d8004b542d83d6d4b7a32a0...ab859e31be5db56106161060033109c9f2d26eca)

### [`v19.2.0-canary-aad7c664-20250829`](https://redirect.github.com/facebook/react/compare/a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628...aad7c664ffbde52e5d8004b542d83d6d4b7a32a0)

[Compare Source](https://redirect.github.com/facebook/react/compare/a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628...aad7c664ffbde52e5d8004b542d83d6d4b7a32a0)

### [`v19.2.0-canary-a96a0f39-20250815`](https://redirect.github.com/facebook/react/compare/a7a116577daf3b135c226ed9db8a8c2f9166c023...a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628)

[Compare Source](https://redirect.github.com/facebook/react/compare/a7a116577daf3b135c226ed9db8a8c2f9166c023...a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628)

### [`v19.2.0-canary-a7a11657-20250708`](https://redirect.github.com/facebook/react/compare/a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d...a7a116577daf3b135c226ed9db8a8c2f9166c023)

[Compare Source](https://redirect.github.com/facebook/react/compare/a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d...a7a116577daf3b135c226ed9db8a8c2f9166c023)

### [`v19.2.0-canary-a00ca6f6-20250611`](https://redirect.github.com/facebook/react/compare/9be531cd37f5558c72f7de360eb921b0074e8544...a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d)

[Compare Source](https://redirect.github.com/facebook/react/compare/9be531cd37f5558c72f7de360eb921b0074e8544...a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d)

### [`v19.2.0-canary-9be531cd-20250729`](https://redirect.github.com/facebook/react/compare/99efc627a5a8cb56f50cfffee544c86c49572b6f...9be531cd37f5558c72f7de360eb921b0074e8544)

[Compare Source](https://redirect.github.com/facebook/react/compare/99efc627a5a8cb56f50cfffee544c86c49572b6f...9be531cd37f5558c72f7de360eb921b0074e8544)

### [`v19.2.0-canary-99efc627-20250523`](https://redirect.github.com/facebook/react/compare/97cdd5d3c33eda77be4f96a43f72d6916d3badbb...99efc627a5a8cb56f50cfffee544c86c49572b6f)

[Compare Source](https://redirect.github.com/facebook/react/compare/97cdd5d3c33eda77be4f96a43f72d6916d3badbb...99efc627a5a8cb56f50cfffee544c86c49572b6f)

### [`v19.2.0-canary-97cdd5d3-20250710`](https://redirect.github.com/facebook/react/compare/9784cb379e249a5495cde5ba3037521207144e91...97cdd5d3c33eda77be4f96a43f72d6916d3badbb)

[Compare Source](https://redirect.github.com/facebook/react/compare/9784cb379e249a5495cde5ba3037521207144e91...97cdd5d3c33eda77be4f96a43f72d6916d3badbb)

### [`v19.2.0-canary-9784cb37-20250730`](https://redirect.github.com/facebook/react/compare/96c61b7f1f145b9fe5103051b636959cdeb20cc8...9784cb379e249a5495cde5ba3037521207144e91)

[Compare Source](https://redirect.github.com/facebook/react/compare/96c61b7f1f145b9fe5103051b636959cdeb20cc8...9784cb379e249a5495cde5ba3037521207144e91)

### [`v19.2.0-canary-96c61b7f-20250709`](https://redirect.github.com/facebook/react/compare/93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1...96c61b7f1f145b9fe5103051b636959cdeb20cc8)

[Compare Source](https://redirect.github.com/facebook/react/compare/93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1...96c61b7f1f145b9fe5103051b636959cdeb20cc8)

### [`v19.2.0-canary-93d7aa69-20250912`](https://redirect.github.com/facebook/react/compare/914319ae595010cd5d3f0e277c77eb86da18e4f0...93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1)

[Compare Source](https://redirect.github.com/facebook/react/compare/914319ae595010cd5d3f0e277c77eb86da18e4f0...93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1)

### [`v19.2.0-canary-914319ae-20250423`](https://redirect.github.com/facebook/react/compare/8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd...914319ae595010cd5d3f0e277c77eb86da18e4f0)

[Compare Source](https://redirect.github.com/facebook/react/compare/8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd...914319ae595010cd5d3f0e277c77eb86da18e4f0)

### [`v19.2.0-canary-8e60cb7e-20250902`](https://redirect.github.com/facebook/react/compare/8d7b5e490320732f40d9c3aa4590b5b0ae5116f5...8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd)

[Compare Source](https://redirect.github.com/facebook/react/compare/8d7b5e490320732f40d9c3aa4590b5b0ae5116f5...8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd)

### [`v19.2.0-canary-8d7b5e49-20250827`](https://redirect.github.com/facebook/react/compare/8ce15b0f56a066ece465963ca1370e46113bb868...8d7b5e490320732f40d9c3aa4590b5b0ae5116f5)

[Compare Source](https://redirect.github.com/facebook/react/compare/8ce15b0f56a066ece465963ca1370e46113bb868...8d7b5e490320732f40d9c3aa4590b5b0ae5116f5)

### [`v19.2.0-canary-8ce15b0f-20250522`](https://redirect.github.com/facebook/react/compare/8a8e9a7edf16fabc1335c9910bddfef66737ee4e...8ce15b0f56a066ece465963ca1370e46113bb868)

[Compare Source](https://redirect.github.com/facebook/react/compare/8a8e9a7edf16fabc1335c9910bddfef66737ee4e...8ce15b0f56a066ece465963ca1370e46113bb868)

### [`v19.2.0-canary-8a8e9a7e-20250912`](https://redirect.github.com/facebook/react/compare/89a803fcec363df9108f2908735e5693280a78b5...8a8e9a7edf16fabc1335c9910bddfef66737ee4e)

[Compare Source](https://redirect.github.com/facebook/react/compare/89a803fcec363df9108f2908735e5693280a78b5...8a8e9a7edf16fabc1335c9910bddfef66737ee4e)

### [`v19.2.0-canary-89a803fc-20250828`](https://redirect.github.com/facebook/react/compare/886b3d36d7994259df2c3ab1983f425a4b718615...89a803fcec363df9108f2908735e5693280a78b5)

[Compare Source](https://redirect.github.com/facebook/react/compare/886b3d36d7994259df2c3ab1983f425a4b718615...89a803fcec363df9108f2908735e5693280a78b5)

### [`v19.2.0-canary-886b3d36-20250910`](https://redirect.github.com/facebook/react/compare/873f71129964350333503c039d9fa5784ea102d1...886b3d36d7994259df2c3ab1983f425a4b718615)

[Compare Source](https://redirect.github.com/facebook/react/compare/873f71129964350333503c039d9fa5784ea102d1...886b3d36d7994259df2c3ab1983f425a4b718615)

### [`v19.2.0-canary-873f7112-20250821`](https://redirect.github.com/facebook/react/compare/84af9085c11411e44cc5e5aee6cf00c02a78986e...873f71129964350333503c039d9fa5784ea102d1)

[Compare Source](https://redirect.github.com/facebook/react/compare/84af9085c11411e44cc5e5aee6cf00c02a78986e...873f71129964350333503c039d9fa5784ea102d1)

### [`v19.2.0-canary-84af9085-20250917`](https://redirect.github.com/facebook/react/compare/7deda941f7f77e82de0311fc3e0cf94d8a863069...84af9085c11411e44cc5e5aee6cf00c02a78986e)

[Compare Source](https://redirect.github.com/facebook/react/compare/7deda941f7f77e82de0311fc3e0cf94d8a863069...84af9085c11411e44cc5e5aee6cf00c02a78986e)

### [`v19.2.0-canary-7deda941-20250804`](https://redirect.github.com/facebook/react/compare/7a2c7045aed222b1ece44a18db6326f2f10c89e3...7deda941f7f77e82de0311fc3e0cf94d8a863069)

[Compare Source](https://redirect.github.com/facebook/react/compare/7a2c7045aed222b1ece44a18db6326f2f10c89e3...7deda941f7f77e82de0311fc3e0cf94d8a863069)

### [`v19.2.0-canary-7a2c7045-20250506`](https://redirect.github.com/facebook/react/compare/30f00e0eec5ed2f3367def1b852efa80ef362092...7a2c7045aed222b1ece44a18db6326f2f10c89e3)

[Compare Source](https://redirect.github.com/facebook/react/compare/30f00e0eec5ed2f3367def1b852efa80ef362092...7a2c7045aed222b1ece44a18db6326f2f10c89e3)

### [`v19.2.0-canary-79d9aed7-20250620`](https://redirect.github.com/facebook/react/compare/7513996f20e34070141aa605fe282ca6986915a0...30f00e0eec5ed2f3367def1b852efa80ef362092)

[Compare Source](https://redirect.github.com/facebook/react/compare/7513996f20e34070141aa605fe282ca6986915a0...30f00e0eec5ed2f3367def1b852efa80ef362092)

### [`v19.2.0-canary-7513996f-20250722`](https://redirect.github.com/facebook/react/compare/73aa744b7029556430f409ec3887a714940698ba...7513996f20e34070141aa605fe282ca6986915a0)

[Compare Source](https://redirect.github.com/facebook/react/compare/73aa744b7029556430f409ec3887a714940698ba...7513996f20e34070141aa605fe282ca6986915a0)

### [`v19.2.0-canary-73aa744b-20250702`](https://redirect.github.com/facebook/react/compare/7216c0f002222cdee3075410f7432d64724640cc...73aa744b7029556430f409ec3887a714940698ba)

[Compare Source](https://redirect.github.com/facebook/react/compare/7216c0f002222cdee3075410f7432d64724640cc...73aa744b7029556430f409ec3887a714940698ba)

### [`v19.2.0-canary-7216c0f0-20250630`](https://redirect.github.com/facebook/react/compare/721350964952457e0b9286867c42135df0c5e787...7216c0f002222cdee3075410f7432d64724640cc)

[Compare Source](https://redirect.github.com/facebook/react/compare/721350964952457e0b9286867c42135df0c5e787...7216c0f002222cdee3075410f7432d64724640cc)

### [`v19.2.0-canary-72135096-20250421`](https://redirect.github.com/facebook/react/compare/6eda534718d09a26d58d65c0a376e05d7e2a3358...721350964952457e0b9286867c42135df0c5e787)

[Compare Source](https://redirect.github.com/facebook/react/compare/6eda534718d09a26d58d65c0a376e05d7e2a3358...721350964952457e0b9286867c42135df0c5e787)

### [`v19.2.0-canary-6eda5347-20250918`](https://redirect.github.com/facebook/react/compare/6de32a5a07958d7fc2f8d0785f5873d2da73b9fa...6eda534718d09a26d58d65c0a376e05d7e2a3358)

[Compare Source](https://redirect.github.com/facebook/react/compare/6de32a5a07958d7fc2f8d0785f5873d2da73b9fa...6eda534718d09a26d58d65c0a376e05d7e2a3358)

### [`v19.2.0-canary-6de32a5a-20250822`](https://redirect.github.com/facebook/react/compare/6b70072c4f21d6762d914adb42007db68f1e00a9...6de32a5a07958d7fc2f8d0785f5873d2da73b9fa)

[Compare Source](https://redirect.github.com/facebook/react/compare/6b70072c4f21d6762d914adb42007db68f1e00a9...6de32a5a07958d7fc2f8d0785f5873d2da73b9fa)

### [`v19.2.0-canary-6b70072c-20250909`](https://redirect.github.com/facebook/react/compare/6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf...6b70072c4f21d6762d914adb42007db68f1e00a9)

[Compare Source](https://redirect.github.com/facebook/react/compare/6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf...6b70072c4f21d6762d914adb42007db68f1e00a9)

### [`v19.2.0-canary-6a7650c7-20250405`](https://redirect.github.com/facebook/react/compare/67a44bcd1b09ab809cf503b39c2568212e13e1a5...6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf)

[Compare Source](https://redirect.github.com/facebook/react/compare/67a44bcd1b09ab809cf503b39c2568212e13e1a5...6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf)

### [`v19.2.0-canary-67a44bcd-20250915`](https://redirect.github.com/facebook/react/compare/66f09bd0540d0a094b80c94d013df885903c97da...67a44bcd1b09ab809cf503b39c2568212e13e1a5)

[Compare Source](https://redirect.github.com/facebook/react/compare/66f09bd0540d0a094b80c94d013df885903c97da...67a44bcd1b09ab809cf503b39c2568212e13e1a5)

### [`v19.2.0-canary-66f09bd0-20250806`](https://redirect.github.com/facebook/react/compare/65c4decb565b4eb1423518e76dbda7bc40a01c04...66f09bd0540d0a094b80c94d013df885903c97da)

[Compare Source](https://redirect.github.com/facebook/react/compare/65c4decb565b4eb1423518e76dbda7bc40a01c04...66f09bd0540d0a094b80c94d013df885903c97da)

### [`v19.2.0-canary-65c4decb-20250630`](https://redirect.github.com/facebook/react/compare/6377903074d4b3a2de48c4da91783a5af9fc5237...65c4decb565b4eb1423518e76dbda7bc40a01c04)

[Compare Source](https://redirect.github.com/facebook/react/compare/6377903074d4b3a2de48c4da91783a5af9fc5237...65c4decb565b4eb1423518e76dbda7bc40a01c04)

### [`v19.2.0-canary-63779030-20250328`](https://redirect.github.com/facebook/react/compare/60b5271a9ad0e9eec2489b999ce774d39d09285b...6377903074d4b3a2de48c4da91783a5af9fc5237)

[Compare Source](https://redirect.github.com/facebook/react/compare/60b5271a9ad0e9eec2489b999ce774d39d09285b...6377903074d4b3a2de48c4da91783a5af9fc5237)

### [`v19.2.0-canary-60b5271a-20250709`](https://redirect.github.com/facebook/react/compare/5e0c951b58a98feed034e2bb92f25ae6d0616855...60b5271a9ad0e9eec2489b999ce774d39d09285b)

[Compare Source](https://redirect.github.com/facebook/react/compare/5e0c951b58a98feed034e2bb92f25ae6d0616855...60b5271a9ad0e9eec2489b999ce774d39d09285b)

### [`v19.2.0-canary-5e0c951b-20250916`](https://redirect.github.com/facebook/react/compare/5dc00d6b2b7798266c1e3b6132f1d076fa9f55d7...5e0c951b58a98feed034e2bb92f25ae6d0616855)

[Compare Source](https://redirect.github.com/facebook/react/compare/5dc00d6b2b7798266c1e3b6132f1d076fa9f55d7...5e0c951b58a98feed034e2bb92f25ae6d0616855)

### [`v19.2.0-canary-5dc00d6b-20250428`](https://redirect.github.com/facebook/react/compare/5d87cd224452c68d09bef99656b6261e9772a210...5dc00d6b2b7798266c1e3b6132f1d076fa9f55d7)

[Compare Source](https://redirect.github.com/facebook/react/compare/5d87cd224452c68d09bef99656b6261e9772a210...5dc00d6b2b7798266c1e3b6132f1d076fa9f55d7)

### [`v19.2.0-canary-5d87cd22-20250704`](https://redirect.github.com/facebook/react/compare/56408a5b12fa4099e9dbbeca7f6bc59e1307e507...5d87cd224452c68d09bef99656b6261e9772a210)

[Compare Source](https://redirect.github.com/facebook/react/compare/56408a5b12fa4099e9dbbeca7f6bc59e1307e507...5d87cd224452c68d09bef99656b6261e9772a210)

### [`v19.2.0-canary-56408a5b-20250610`](https://redirect.github.com/facebook/react/compare/540cd65252ced9f970fb97d5f5b7f029bd7cac83...56408a5b12fa4099e9dbbeca7f6bc59e1307e507)

[Compare Source](https://redirect.github.com/facebook/react/compare/540cd65252ced9f970fb97d5f5b7f029bd7cac83...56408a5b12fa4099e9dbbeca7f6bc59e1307e507)

### [`v19.2.0-canary-540cd652-20250403`](https://redirect.github.com/facebook/react/compare/534bed5fa7ea927b00c48b348bee9a8087b68f9c...540cd65252ced9f970fb97d5f5b7f029bd7cac83)

[Compare Source](https://redirect.github.com/facebook/react/compare/534bed5fa7ea927b00c48b348bee9a8087b68f9c...540cd65252ced9f970fb97d5f5b7f029bd7cac83)

### [`v19.2.0-canary-534bed5f-20250813`](https://redirect.github.com/facebook/react/compare/526dd340b3e77193846fe5eed02b9bb89d7c2d15...534bed5fa7ea927b00c48b348bee9a8087b68f9c)

[Compare Source](https://redirect.github.com/facebook/react/compare/526dd340b3e77193846fe5eed02b9bb89d7c2d15...534bed5fa7ea927b00c48b348bee9a8087b68f9c)

### [`v19.2.0-canary-526dd340-20250602`](https://redirect.github.com/facebook/react/compare/4db4b21c63ebc4edc508c5f7674f9df50d8f9744...526dd340b3e77193846fe5eed02b9bb89d7c2d15)

[Compare Source](https://redirect.github.com/facebook/react/compare/4db4b21c63ebc4edc508c5f7674f9df50d8f9744...526dd340b3e77193846fe5eed02b9bb89d7c2d15)

### [`v19.2.0-canary-4db4b21c-20250626`](https://redirect.github.com/facebook/react/compare/4a45ba92c4097a97333c04b5516ba2d5c81af716...4db4b21c63ebc4edc508c5f7674f9df50d8f9744)

[Compare Source](https://redirect.github.com/facebook/react/compare/4a45ba92c4097a97333c04b5516ba2d5c81af716...4db4b21c63ebc4edc508c5f7674f9df50d8f9744)

### [`v19.2.0-canary-4a45ba92-20250515`](https://redirect.github.com/facebook/react/compare/4a36d3eab7d9bbbfae62699989aa95e5a0297c16...4a45ba92c4097a97333c04b5516ba2d5c81af716)

[Compare Source](https://redirect.github.com/facebook/react/compare/4a36d3eab7d9bbbfae62699989aa95e5a0297c16...4a45ba92c4097a97333c04b5516ba2d5c81af716)

### [`v19.2.0-canary-4a36d3ea-20250416`](https://redirect.github.com/facebook/react/compare/462d08f9ba41d48ab36bf405235c1c22023603dc...4a36d3eab7d9bbbfae62699989aa95e5a0297c16)

[Compare Source](https://redirect.github.com/facebook/react/compare/462d08f9ba41d48ab36bf405235c1c22023603dc...4a36d3eab7d9bbbfae62699989aa95e5a0297c16)

### [`v19.2.0-canary-462d08f9-20250517`](https://redirect.github.com/facebook/react/compare/4448b18760d867f9e009e810571e7a3b8930bb19...462d08f9ba41d48ab36bf405235c1c22023603dc)

[Compare Source](https://redirect.github.com/facebook/react/compare/4448b18760d867f9e009e810571e7a3b8930bb19...462d08f9ba41d48ab36bf405235c1c22023603dc)

### [`v19.2.0-canary-4448b187-20250515`](https://redirect.github.com/facebook/react/compare/4123f6b771bb71a2831b1c450c385c38530125a0...4448b18760d867f9e009e810571e7a3b8930bb19)

[Compare Source](https://redirect.github.com/facebook/react/compare/4123f6b771bb71a2831b1c450c385c38530125a0...4448b18760d867f9e009e810571e7a3b8930bb19)

### [`v19.2.0-canary-4123f6b7-20250826`](https://redirect.github.com/facebook/react/compare/408d055a3b89794088130ed39bf42ca540766275...4123f6b771bb71a2831b1c450c385c38530125a0)

[Compare Source](https://redirect.github.com/facebook/react/compare/408d055a3b89794088130ed39bf42ca540766275...4123f6b771bb71a2831b1c450c385c38530125a0)

### [`v19.2.0-canary-408d055a-20250430`](https://redirect.github.com/facebook/react/compare/3fbfb9baaf38528349b86372bd7eff36c6a3261a...408d055a3b89794088130ed39bf42ca540766275)

[Compare Source](https://redirect.github.com/facebook/react/compare/3fbfb9baaf38528349b86372bd7eff36c6a3261a...408d055a3b89794088130ed39bf42ca540766275)

### [`v19.2.0-canary-3fbfb9ba-20250409`](https://redirect.github.com/facebook/react/compare/3fb190f729ddcf32e7a76961082929683a3395a7...3fbfb9baaf38528349b86372bd7eff36c6a3261a)

[Compare Source](https://redirect.github.com/facebook/react/compare/3fb190f729ddcf32e7a76961082929683a3395a7...3fbfb9baaf38528349b86372bd7eff36c6a3261a)

</details>

<details>
<summary>facebook/react (react-dom)</summary>

### [`v19.2.0-canary-d415fd3e-20250919`](https://redirect.github.com/facebook/react/compare/cee7939b0017ff58230e19663c22393bfd9025ef...d415fd3ed716f02f463232341ab21e909e0058ca)

[Compare Source](https://redirect.github.com/facebook/react/compare/cee7939b0017ff58230e19663c22393bfd9025ef...d415fd3ed716f02f463232341ab21e909e0058ca)

### [`v19.2.0-canary-cee7939b-20250625`](https://redirect.github.com/facebook/react/compare/c498bfce8b9baa3dd21bd0d5124eb3a4549886f1...cee7939b0017ff58230e19663c22393bfd9025ef)

[Compare Source](https://redirect.github.com/facebook/react/compare/c498bfce8b9baa3dd21bd0d5124eb3a4549886f1...cee7939b0017ff58230e19663c22393bfd9025ef)

### [`v19.2.0-canary-c498bfce-20250426`](https://redirect.github.com/facebook/react/compare/c4676e72a630f3e93634c2b004b3be07b17a79c8...c498bfce8b9baa3dd21bd0d5124eb3a4549886f1)

[Compare Source](https://redirect.github.com/facebook/react/compare/c4676e72a630f3e93634c2b004b3be07b17a79c8...c498bfce8b9baa3dd21bd0d5124eb3a4549886f1)

### [`v19.2.0-canary-c4676e72-20250520`](https://redirect.github.com/facebook/react/compare/c44e4a250557e53b120e40db8b01fb5fd93f1e35...c4676e72a630f3e93634c2b004b3be07b17a79c8)

[Compare Source](https://redirect.github.com/facebook/react/compare/c44e4a250557e53b120e40db8b01fb5fd93f1e35...c4676e72a630f3e93634c2b004b3be07b17a79c8)

### [`v19.2.0-canary-c44e4a25-20250409`](https://redirect.github.com/facebook/react/compare/c260b38d0a082641342fc45ff5ac96e32f764f20...c44e4a250557e53b120e40db8b01fb5fd93f1e35)

[Compare Source](https://redirect.github.com/facebook/react/compare/c260b38d0a082641342fc45ff5ac96e32f764f20...c44e4a250557e53b120e40db8b01fb5fd93f1e35)

### [`v19.2.0-canary-c260b38d-20250731`](https://redirect.github.com/facebook/react/compare/c129c2424b662a371865a0145c562a1cf934b023...c260b38d0a082641342fc45ff5ac96e32f764f20)

[Compare Source](https://redirect.github.com/facebook/react/compare/c129c2424b662a371865a0145c562a1cf934b023...c260b38d0a082641342fc45ff5ac96e32f764f20)

### [`v19.2.0-canary-c129c242-20250505`](https://redirect.github.com/facebook/react/compare/c0464aedb16b1c970d717651bba8d1c66c578729...c129c2424b662a371865a0145c562a1cf934b023)

[Compare Source](https://redirect.github.com/facebook/react/compare/c0464aedb16b1c970d717651bba8d1c66c578729...c129c2424b662a371865a0145c562a1cf934b023)

### [`v19.2.0-canary-c0464aed-20250523`](https://redirect.github.com/facebook/react/compare/befc1246b07a04b401bc6e914b7f336a442dca1a...c0464aedb16b1c970d717651bba8d1c66c578729)

[Compare Source](https://redirect.github.com/facebook/react/compare/befc1246b07a04b401bc6e914b7f336a442dca1a...c0464aedb16b1c970d717651bba8d1c66c578729)

### [`v19.2.0-canary-befc1246-20250708`](https://redirect.github.com/facebook/react/compare/be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14...befc1246b07a04b401bc6e914b7f336a442dca1a)

[Compare Source](https://redirect.github.com/facebook/react/compare/be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14...befc1246b07a04b401bc6e914b7f336a442dca1a)

### [`v19.2.0-canary-be11cb5c-20250804`](https://redirect.github.com/facebook/react/compare/bdb4a96f628d3b426d3c79fbd598ec35c05835a3...be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14)

[Compare Source](https://redirect.github.com/facebook/react/compare/bdb4a96f628d3b426d3c79fbd598ec35c05835a3...be11cb5c4b36b42dcc4c8bdcbc67d9a9b4ac2e14)

### [`v19.2.0-canary-bdb4a96f-20250801`](https://redirect.github.com/facebook/react/compare/bc6184dd993e6ea0efdee7553293676db774c3ca...bdb4a96f628d3b426d3c79fbd598ec35c05835a3)

[Compare Source](https://redirect.github.com/facebook/react/compare/bc6184dd993e6ea0efdee7553293676db774c3ca...bdb4a96f628d3b426d3c79fbd598ec35c05835a3)

### [`v19.2.0-canary-bc6184dd-20250417`](https://redirect.github.com/facebook/react/compare/bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36...bc6184dd993e6ea0efdee7553293676db774c3ca)

[Compare Source](https://redirect.github.com/facebook/react/compare/bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36...bc6184dd993e6ea0efdee7553293676db774c3ca)

### [`v19.2.0-canary-bbc13fa1-20250624`](https://redirect.github.com/facebook/react/compare/bb6f0c8d2f29754347db0ff28186dc89c128b6ca...bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36)

[Compare Source](https://redirect.github.com/facebook/react/compare/bb6f0c8d2f29754347db0ff28186dc89c128b6ca...bbc13fa17be8eebef3e6ee47f48c76c0c44e2f36)

### [`v19.2.0-canary-bb6f0c8d-20250901`](https://redirect.github.com/facebook/react/compare/edf550b67936f2c62534ad5549bf580a4f581bd8...bb6f0c8d2f29754347db0ff28186dc89c128b6ca)

[Compare Source](https://redirect.github.com/facebook/react/compare/edf550b67936f2c62534ad5549bf580a4f581bd8...bb6f0c8d2f29754347db0ff28186dc89c128b6ca)

### [`v19.2.0-canary-b9cfa0d3-20250505`](https://redirect.github.com/facebook/react/compare/b9a045368bc1186fcaff6e8b027cfca28c857f04...edf550b67936f2c62534ad5549bf580a4f581bd8)

[Compare Source](https://redirect.github.com/facebook/react/compare/b9a045368bc1186fcaff6e8b027cfca28c857f04...edf550b67936f2c62534ad5549bf580a4f581bd8)

### [`v19.2.0-canary-b9a04536-20250904`](https://redirect.github.com/facebook/react/compare/b94603b95504130aec72f61e02d7b66d48f33653...b9a045368bc1186fcaff6e8b027cfca28c857f04)

[Compare Source](https://redirect.github.com/facebook/react/compare/b94603b95504130aec72f61e02d7b66d48f33653...b9a045368bc1186fcaff6e8b027cfca28c857f04)

### [`v19.2.0-canary-b94603b9-20250513`](https://redirect.github.com/facebook/react/compare/b7e2de632b2a160bc09edda1fbb9b8f85a6914e8...b94603b95504130aec72f61e02d7b66d48f33653)

[Compare Source](https://redirect.github.com/facebook/react/compare/b7e2de632b2a160bc09edda1fbb9b8f85a6914e8...b94603b95504130aec72f61e02d7b66d48f33653)

### [`v19.2.0-canary-b7e2de63-20250611`](https://redirect.github.com/facebook/react/compare/b6c0aa88140bba2a61c1de16bda2505c89b26235...b7e2de632b2a160bc09edda1fbb9b8f85a6914e8)

[Compare Source](https://redirect.github.com/facebook/react/compare/b6c0aa88140bba2a61c1de16bda2505c89b26235...b7e2de632b2a160bc09edda1fbb9b8f85a6914e8)

### [`v19.2.0-canary-b6c0aa88-20250609`](https://redirect.github.com/facebook/react/compare/b4477d3800ccb0bdf26670cd1f021d094159c38f...b6c0aa88140bba2a61c1de16bda2505c89b26235)

[Compare Source](https://redirect.github.com/facebook/react/compare/b4477d3800ccb0bdf26670cd1f021d094159c38f...b6c0aa88140bba2a61c1de16bda2505c89b26235)

### [`v19.2.0-canary-b4477d38-20250605`](https://redirect.github.com/facebook/react/compare/b1b0955f2b34286a7408e58463f4cc429627f9a8...b4477d3800ccb0bdf26670cd1f021d094159c38f)

[Compare Source](https://redirect.github.com/facebook/react/compare/b1b0955f2b34286a7408e58463f4cc429627f9a8...b4477d3800ccb0bdf26670cd1f021d094159c38f)

### [`v19.2.0-canary-b1b0955f-20250901`](https://redirect.github.com/facebook/react/compare/b10cb4c01ec1ae41b67422239d919f261fefa7d1...b1b0955f2b34286a7408e58463f4cc429627f9a8)

[Compare Source](https://redirect.github.com/facebook/react/compare/b10cb4c01ec1ae41b67422239d919f261fefa7d1...b1b0955f2b34286a7408e58463f4cc429627f9a8)

### [`v19.2.0-canary-b10cb4c0-20250403`](https://redirect.github.com/facebook/react/compare/b07717d857422af5fb1c2ee0930e5a2a62df2b0e...b10cb4c01ec1ae41b67422239d919f261fefa7d1)

[Compare Source](https://redirect.github.com/facebook/react/compare/b07717d857422af5fb1c2ee0930e5a2a62df2b0e...b10cb4c01ec1ae41b67422239d919f261fefa7d1)

### [`v19.2.0-canary-b07717d8-20250528`](https://redirect.github.com/facebook/react/compare/b04254fdcee30871760301f34236ee0dfadf86ab...b07717d857422af5fb1c2ee0930e5a2a62df2b0e)

[Compare Source](https://redirect.github.com/facebook/react/compare/b04254fdcee30871760301f34236ee0dfadf86ab...b07717d857422af5fb1c2ee0930e5a2a62df2b0e)

### [`v19.2.0-canary-b04254fd-20250415`](https://redirect.github.com/facebook/react/compare/ac7820a99efac29dcd5a69f6d2438f6d31b7abbf...b04254fdcee30871760301f34236ee0dfadf86ab)

[Compare Source](https://redirect.github.com/facebook/react/compare/ac7820a99efac29dcd5a69f6d2438f6d31b7abbf...b04254fdcee30871760301f34236ee0dfadf86ab)

### [`v19.2.0-canary-ac7820a9-20250811`](https://redirect.github.com/facebook/react/compare/ab859e31be5db56106161060033109c9f2d26eca...ac7820a99efac29dcd5a69f6d2438f6d31b7abbf)

[Compare Source](https://redirect.github.com/facebook/react/compare/ab859e31be5db56106161060033109c9f2d26eca...ac7820a99efac29dcd5a69f6d2438f6d31b7abbf)

### [`v19.2.0-canary-ab859e31-20250606`](https://redirect.github.com/facebook/react/compare/aad7c664ffbde52e5d8004b542d83d6d4b7a32a0...ab859e31be5db56106161060033109c9f2d26eca)

[Compare Source](https://redirect.github.com/facebook/react/compare/aad7c664ffbde52e5d8004b542d83d6d4b7a32a0...ab859e31be5db56106161060033109c9f2d26eca)

### [`v19.2.0-canary-aad7c664-20250829`](https://redirect.github.com/facebook/react/compare/a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628...aad7c664ffbde52e5d8004b542d83d6d4b7a32a0)

[Compare Source](https://redirect.github.com/facebook/react/compare/a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628...aad7c664ffbde52e5d8004b542d83d6d4b7a32a0)

### [`v19.2.0-canary-a96a0f39-20250815`](https://redirect.github.com/facebook/react/compare/a7a116577daf3b135c226ed9db8a8c2f9166c023...a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628)

[Compare Source](https://redirect.github.com/facebook/react/compare/a7a116577daf3b135c226ed9db8a8c2f9166c023...a96a0f3903ea0a9d45ff7c30a3fd9efe830c4628)

### [`v19.2.0-canary-a7a11657-20250708`](https://redirect.github.com/facebook/react/compare/a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d...a7a116577daf3b135c226ed9db8a8c2f9166c023)

[Compare Source](https://redirect.github.com/facebook/react/compare/a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d...a7a116577daf3b135c226ed9db8a8c2f9166c023)

### [`v19.2.0-canary-a00ca6f6-20250611`](https://redirect.github.com/facebook/react/compare/9be531cd37f5558c72f7de360eb921b0074e8544...a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d)

[Compare Source](https://redirect.github.com/facebook/react/compare/9be531cd37f5558c72f7de360eb921b0074e8544...a00ca6f6b51e46a0ccec54a2231bfe7a1ed9ae1d)

### [`v19.2.0-canary-9be531cd-20250729`](https://redirect.github.com/facebook/react/compare/99efc627a5a8cb56f50cfffee544c86c49572b6f...9be531cd37f5558c72f7de360eb921b0074e8544)

[Compare Source](https://redirect.github.com/facebook/react/compare/99efc627a5a8cb56f50cfffee544c86c49572b6f...9be531cd37f5558c72f7de360eb921b0074e8544)

### [`v19.2.0-canary-99efc627-20250523`](https://redirect.github.com/facebook/react/compare/97cdd5d3c33eda77be4f96a43f72d6916d3badbb...99efc627a5a8cb56f50cfffee544c86c49572b6f)

[Compare Source](https://redirect.github.com/facebook/react/compare/97cdd5d3c33eda77be4f96a43f72d6916d3badbb...99efc627a5a8cb56f50cfffee544c86c49572b6f)

### [`v19.2.0-canary-97cdd5d3-20250710`](https://redirect.github.com/facebook/react/compare/9784cb379e249a5495cde5ba3037521207144e91...97cdd5d3c33eda77be4f96a43f72d6916d3badbb)

[Compare Source](https://redirect.github.com/facebook/react/compare/9784cb379e249a5495cde5ba3037521207144e91...97cdd5d3c33eda77be4f96a43f72d6916d3badbb)

### [`v19.2.0-canary-9784cb37-20250730`](https://redirect.github.com/facebook/react/compare/96c61b7f1f145b9fe5103051b636959cdeb20cc8...9784cb379e249a5495cde5ba3037521207144e91)

[Compare Source](https://redirect.github.com/facebook/react/compare/96c61b7f1f145b9fe5103051b636959cdeb20cc8...9784cb379e249a5495cde5ba3037521207144e91)

### [`v19.2.0-canary-96c61b7f-20250709`](https://redirect.github.com/facebook/react/compare/93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1...96c61b7f1f145b9fe5103051b636959cdeb20cc8)

[Compare Source](https://redirect.github.com/facebook/react/compare/93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1...96c61b7f1f145b9fe5103051b636959cdeb20cc8)

### [`v19.2.0-canary-93d7aa69-20250912`](https://redirect.github.com/facebook/react/compare/914319ae595010cd5d3f0e277c77eb86da18e4f0...93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1)

[Compare Source](https://redirect.github.com/facebook/react/compare/914319ae595010cd5d3f0e277c77eb86da18e4f0...93d7aa69b29c20529c40cf64b0afdb5d51c9ddd1)

### [`v19.2.0-canary-914319ae-20250423`](https://redirect.github.com/facebook/react/compare/8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd...914319ae595010cd5d3f0e277c77eb86da18e4f0)

[Compare Source](https://redirect.github.com/facebook/react/compare/8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd...914319ae595010cd5d3f0e277c77eb86da18e4f0)

### [`v19.2.0-canary-8e60cb7e-20250902`](https://redirect.github.com/facebook/react/compare/8d7b5e490320732f40d9c3aa4590b5b0ae5116f5...8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd)

[Compare Source](https://redirect.github.com/facebook/react/compare/8d7b5e490320732f40d9c3aa4590b5b0ae5116f5...8e60cb7ed55a3dce35bd809b4cf1ad803c59abfd)

### [`v19.2.0-canary-8d7b5e49-20250827`](https://redirect.github.com/facebook/react/compare/8ce15b0f56a066ece465963ca1370e46113bb868...8d7b5e490320732f40d9c3aa4590b5b0ae5116f5)

[Compare Source](https://redirect.github.com/facebook/react/compare/8ce15b0f56a066ece465963ca1370e46113bb868...8d7b5e490320732f40d9c3aa4590b5b0ae5116f5)

### [`v19.2.0-canary-8ce15b0f-20250522`](https://redirect.github.com/facebook/react/compare/8a8e9a7edf16fabc1335c9910bddfef66737ee4e...8ce15b0f56a066ece465963ca1370e46113bb868)

[Compare Source](https://redirect.github.com/facebook/react/compare/8a8e9a7edf16fabc1335c9910bddfef66737ee4e...8ce15b0f56a066ece465963ca1370e46113bb868)

### [`v19.2.0-canary-8a8e9a7e-20250912`](https://redirect.github.com/facebook/react/compare/89a803fcec363df9108f2908735e5693280a78b5...8a8e9a7edf16fabc1335c9910bddfef66737ee4e)

[Compare Source](https://redirect.github.com/facebook/react/compare/89a803fcec363df9108f2908735e5693280a78b5...8a8e9a7edf16fabc1335c9910bddfef66737ee4e)

### [`v19.2.0-canary-89a803fc-20250828`](https://redirect.github.com/facebook/react/compare/886b3d36d7994259df2c3ab1983f425a4b718615...89a803fcec363df9108f2908735e5693280a78b5)

[Compare Source](https://redirect.github.com/facebook/react/compare/886b3d36d7994259df2c3ab1983f425a4b718615...89a803fcec363df9108f2908735e5693280a78b5)

### [`v19.2.0-canary-886b3d36-20250910`](https://redirect.github.com/facebook/react/compare/873f71129964350333503c039d9fa5784ea102d1...886b3d36d7994259df2c3ab1983f425a4b718615)

[Compare Source](https://redirect.github.com/facebook/react/compare/873f71129964350333503c039d9fa5784ea102d1...886b3d36d7994259df2c3ab1983f425a4b718615)

### [`v19.2.0-canary-873f7112-20250821`](https://redirect.github.com/facebook/react/compare/84af9085c11411e44cc5e5aee6cf00c02a78986e...873f71129964350333503c039d9fa5784ea102d1)

[Compare Source](https://redirect.github.com/facebook/react/compare/84af9085c11411e44cc5e5aee6cf00c02a78986e...873f71129964350333503c039d9fa5784ea102d1)

### [`v19.2.0-canary-84af9085-20250917`](https://redirect.github.com/facebook/react/compare/7deda941f7f77e82de0311fc3e0cf94d8a863069...84af9085c11411e44cc5e5aee6cf00c02a78986e)

[Compare Source](https://redirect.github.com/facebook/react/compare/7deda941f7f77e82de0311fc3e0cf94d8a863069...84af9085c11411e44cc5e5aee6cf00c02a78986e)

### [`v19.2.0-canary-7deda941-20250804`](https://redirect.github.com/facebook/react/compare/7a2c7045aed222b1ece44a18db6326f2f10c89e3...7deda941f7f77e82de0311fc3e0cf94d8a863069)

[Compare Source](https://redirect.github.com/facebook/react/compare/7a2c7045aed222b1ece44a18db6326f2f10c89e3...7deda941f7f77e82de0311fc3e0cf94d8a863069)

### [`v19.2.0-canary-7a2c7045-20250506`](https://redirect.github.com/facebook/react/compare/30f00e0eec5ed2f3367def1b852efa80ef362092...7a2c7045aed222b1ece44a18db6326f2f10c89e3)

[Compare Source](https://redirect.github.com/facebook/react/compare/30f00e0eec5ed2f3367def1b852efa80ef362092...7a2c7045aed222b1ece44a18db6326f2f10c89e3)

### [`v19.2.0-canary-79d9aed7-20250620`](https://redirect.github.com/facebook/react/compare/7513996f20e34070141aa605fe282ca6986915a0...30f00e0eec5ed2f3367def1b852efa80ef362092)

[Compare Source](https://redirect.github.com/facebook/react/compare/7513996f20e34070141aa605fe282ca6986915a0...30f00e0eec5ed2f3367def1b852efa80ef362092)

### [`v19.2.0-canary-7513996f-20250722`](https://redirect.github.com/facebook/react/compare/73aa744b7029556430f409ec3887a714940698ba...7513996f20e34070141aa605fe282ca6986915a0)

[Compare Source](https://redirect.github.com/facebook/react/compare/73aa744b7029556430f409ec3887a714940698ba...7513996f20e34070141aa605fe282ca6986915a0)

### [`v19.2.0-canary-73aa744b-20250702`](https://redirect.github.com/facebook/react/compare/7216c0f002222cdee3075410f7432d64724640cc...73aa744b7029556430f409ec3887a714940698ba)

[Compare Source](https://redirect.github.com/facebook/react/compare/7216c0f002222cdee3075410f7432d64724640cc...73aa744b7029556430f409ec3887a714940698ba)

### [`v19.2.0-canary-7216c0f0-20250630`](https://redirect.github.com/facebook/react/compare/721350964952457e0b9286867c42135df0c5e787...7216c0f002222cdee3075410f7432d64724640cc)

[Compare Source](https://redirect.github.com/facebook/react/compare/721350964952457e0b9286867c42135df0c5e787...7216c0f002222cdee3075410f7432d64724640cc)

### [`v19.2.0-canary-72135096-20250421`](https://redirect.github.com/facebook/react/compare/6eda534718d09a26d58d65c0a376e05d7e2a3358...721350964952457e0b9286867c42135df0c5e787)

[Compare Source](https://redirect.github.com/facebook/react/compare/6eda534718d09a26d58d65c0a376e05d7e2a3358...721350964952457e0b9286867c42135df0c5e787)

### [`v19.2.0-canary-6eda5347-20250918`](https://redirect.github.com/facebook/react/compare/6de32a5a07958d7fc2f8d0785f5873d2da73b9fa...6eda534718d09a26d58d65c0a376e05d7e2a3358)

[Compare Source](https://redirect.github.com/facebook/react/compare/6de32a5a07958d7fc2f8d0785f5873d2da73b9fa...6eda534718d09a26d58d65c0a376e05d7e2a3358)

### [`v19.2.0-canary-6de32a5a-20250822`](https://redirect.github.com/facebook/react/compare/6b70072c4f21d6762d914adb42007db68f1e00a9...6de32a5a07958d7fc2f8d0785f5873d2da73b9fa)

[Compare Source](https://redirect.github.com/facebook/react/compare/6b70072c4f21d6762d914adb42007db68f1e00a9...6de32a5a07958d7fc2f8d0785f5873d2da73b9fa)

### [`v19.2.0-canary-6b70072c-20250909`](https://redirect.github.com/facebook/react/compare/6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf...6b70072c4f21d6762d914adb42007db68f1e00a9)

[Compare Source](https://redirect.github.com/facebook/react/compare/6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf...6b70072c4f21d6762d914adb42007db68f1e00a9)

### [`v19.2.0-canary-6a7650c7-20250405`](https://redirect.github.com/facebook/react/compare/67a44bcd1b09ab809cf503b39c2568212e13e1a5...6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf)

[Compare Source](https://redirect.github.com/facebook/react/compare/67a44bcd1b09ab809cf503b39c2568212e13e1a5...6a7650c75c1bc110517bd9b3eefdc66eadbb9cbf)

### [`v19.2.0-canary-67a44bcd-20250915`](https://redirect.github.com/facebook/react/compare/66f09bd0540d0a094b80c94d013df885903c97da...67a44bcd1b09ab809cf503b39c2568212e13e1a5)

[Compare Source](https://redirect.github.com/facebook/react/compare/66f09bd0540d0a094b80c94d013df885903c97da...67a44bcd1b09ab809cf503b39c2568212e13e1a5)

### [`v19.2.0-canary-66f09bd0-20250806`](https://redirect.github.com/facebook/react/compare/65c4decb565b4eb1423518e76dbda7bc40a01c04...66f09bd0540d0a094b80c94d013df885903c97da)

[Compare Source](https://redirect.github.com/facebook/react/compare/65c4decb565b4eb1423518e76dbda7bc40a01c04...66f09bd0540d0a094b80c94d013df885903c97da)

### [`v19.2.0-canary-65c4decb-20250630`](https://redirect.github.com/facebook/react/compare/6377903074d4b3a2de48c4da91783a5af9fc5237...65c4decb565b4eb1423518e76dbda7bc40a01c04)



</details>

---

### Configuration

📅 **Schedule**: Branch creation - "every weekend" (UTC), Automerge - At any time (no schedule defined).

🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.

♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.

👻 **Immortal**: This PR will be recreated if closed unmerged. Get [config help](https://redirect.github.com/renovatebot/renovate/discussions) if that's undesired.

---

 - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box

---

This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/redwoodjs/sdk).
<!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0MS45Ny4xMCIsInVwZGF0ZWRJblZlciI6IjQxLjk3LjEwIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119-->


---

### PR #748 - chore: Greenkeeping configuration
https://github.com/redwoodjs/sdk/pull/748
Author: @justinvdm  Merged: 2025-09-19T10:07:44Z

Introduces an automated dependency greenkeeping strategy for the repository using the Renovate GitHub App. It adds a `renovate.json` configuration file that defines a comprehensive set of rules for managing updates across the entire monorepo in a controlled and low-noise manner.

**Configuration Details:**

-   **Dependency Grouping**: Dependencies are categorized into four distinct groups (`starter-peer-deps`, `sdk-internal-deps`, `starter-deps`, `docs-and-infra-deps`) to manage their update cadences based on their impact.
-   **High-Priority Peer Dependencies**: Critical peer dependencies (Cloudflare, Vite, React) are updated as soon as new versions are available. This provides an immediate early-warning signal for any regressions that could affect users.
-   **Weekly Grouped Updates**: All other dependencies, including the SDK's internal tooling, starter application dependencies, and repository infrastructure, are consolidated into single, weekly pull requests to minimize CI noise.
-   **Special Handling for React Canaries**: A specific rule (`"followTag": "next"`) has been implemented for React packages. This instructs Renovate to track the `next` distribution tag on npm, which is necessary to correctly handle the non-standard versioning of React's pre-release builds.

**New Processes and Documentation:**

-   **Failure Protocol**: A protocol for what to do when a peer dependency update fails CI smoke tests has been documented. It covers the likely reasons for a failure (such as an issue with compatibility, reliance on implicit API behavior, or an actual bug in the dependency) and outlines the manual steps a maintainer should take to investigate and resolve the issue.
-   **`CONTRIBUTING.md` Updates**: The contributor guide has been updated with a new "Dependency Management and Greenkeeping" section. This document details the different dependency categories, the update strategy for each, the failure protocol, and instructions on how to use the Renovate Dependency Dashboard to manually trigger updates.

---

### PR #751 - fix(deps): update sdk-internal-deps
https://github.com/redwoodjs/sdk/pull/751
Author: @app/renovate  Merged: 2025-09-29T09:36:03Z

chore(deps): fix(deps): update sdk-internal-deps

This PR contains the following updates:

| Package | Change | Age | Confidence |
|---|---|---|---|
| [@ast-grep/napi](https://ast-grep.github.io) ([source](https://redirect.github.com/ast-grep/ast-grep)) | [`~0.38.5` -> `~0.39.0`](https://renovatebot.com/diffs/npm/@ast-grep%2fnapi/0.38.5/0.39.5) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@ast-grep%2fnapi/0.39.5?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@ast-grep%2fnapi/0.38.5/0.39.5?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@cloudflare/workers-types](https://redirect.github.com/cloudflare/workerd) | [`~4.20250906.0` -> `~4.20250924.0`](https://renovatebot.com/diffs/npm/@cloudflare%2fworkers-types/4.20250906.0/4.20250924.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@cloudflare%2fworkers-types/4.20250924.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@cloudflare%2fworkers-types/4.20250906.0/4.20250924.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@puppeteer/browsers](https://redirect.github.com/puppeteer/puppeteer/tree/main#readme) ([source](https://redirect.github.com/puppeteer/puppeteer)) | [`~2.8.0` -> `~2.10.0`](https://renovatebot.com/diffs/npm/@puppeteer%2fbrowsers/2.8.0/2.10.10) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@puppeteer%2fbrowsers/2.10.10?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@puppeteer%2fbrowsers/2.8.0/2.10.10?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@types/lodash](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/lodash) ([source](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/lodash)) | [`4.17.16` -> `4.17.20`](https://renovatebot.com/diffs/npm/@types%2flodash/4.17.16/4.17.20) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@types%2flodash/4.17.20?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@types%2flodash/4.17.16/4.17.20?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@types/react](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react) ([source](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/react)) | [`19.1.2` -> `19.1.13`](https://renovatebot.com/diffs/npm/@types%2freact/19.1.2/19.1.13) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@types%2freact/19.1.13?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@types%2freact/19.1.2/19.1.13?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@types/react-dom](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/master/types/react-dom) ([source](https://redirect.github.com/DefinitelyTyped/DefinitelyTyped/tree/HEAD/types/react-dom)) | [`19.1.2` -> `19.1.9`](https://renovatebot.com/diffs/npm/@types%2freact-dom/19.1.2/19.1.9) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@types%2freact-dom/19.1.9?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@types%2freact-dom/19.1.2/19.1.9?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [@vitejs/plugin-react](https://redirect.github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react#readme) ([source](https://redirect.github.com/vitejs/vite-plugin-react/tree/HEAD/packages/plugin-react)) | [`~4.3.4` -> `~5.0.0`](https://renovatebot.com/diffs/npm/@vitejs%2fplugin-react/4.3.4/5.0.3) | [![age](https://developer.mend.io/api/mc/badges/age/npm/@vitejs%2fplugin-react/5.0.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/@vitejs%2fplugin-react/4.3.4/5.0.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [chokidar](https://redirect.github.com/paulmillr/chokidar) | [`~3.6.0` -> `~4.0.0`](https://renovatebot.com/diffs/npm/chokidar/3.6.0/4.0.3) | [![age](https://developer.mend.io/api/mc/badges/age/npm/chokidar/4.0.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/chokidar/3.6.0/4.0.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [debug](https://redirect.github.com/debug-js/debug) | [`4.4.1` -> `4.4.3`](https://renovatebot.com/diffs/npm/debug/4.4.1/4.4.3) | [![age](https://developer.mend.io/api/mc/badges/age/npm/debug/4.4.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/debug/4.4.1/4.4.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [execa](https://redirect.github.com/sindresorhus/execa) | [`~9.5.2` -> `~9.6.0`](https://renovatebot.com/diffs/npm/execa/9.5.2/9.6.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/execa/9.6.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/execa/9.5.2/9.6.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [glob](https://redirect.github.com/isaacs/node-glob) | [`11.0.1` -> `11.0.3`](https://renovatebot.com/diffs/npm/glob/11.0.1/11.0.3) | [![age](https://developer.mend.io/api/mc/badges/age/npm/glob/11.0.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/glob/11.0.1/11.0.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [ignore](https://redirect.github.com/kaelzhang/node-ignore) | [`7.0.4` -> `7.0.5`](https://renovatebot.com/diffs/npm/ignore/7.0.4/7.0.5) | [![age](https://developer.mend.io/api/mc/badges/age/npm/ignore/7.0.5?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/ignore/7.0.4/7.0.5?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [kysely](https://kysely.dev) ([source](https://redirect.github.com/kysely-org/kysely)) | [`0.28.2` -> `0.28.7`](https://renovatebot.com/diffs/npm/kysely/0.28.2/0.28.7) | [![age](https://developer.mend.io/api/mc/badges/age/npm/kysely/0.28.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/kysely/0.28.2/0.28.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [miniflare](https://redirect.github.com/cloudflare/workers-sdk/tree/main/packages/miniflare#readme) ([source](https://redirect.github.com/cloudflare/workers-sdk/tree/HEAD/packages/miniflare)) | [`~4.20250405.0` -> `~4.20250924.0`](https://renovatebot.com/diffs/npm/miniflare/4.20250405.0/4.20250924.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/miniflare/4.20250924.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/miniflare/4.20250405.0/4.20250924.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [puppeteer-core](https://redirect.github.com/puppeteer/puppeteer/tree/main#readme) ([source](https://redirect.github.com/puppeteer/puppeteer)) | [`~22.8.1` -> `~24.22.0`](https://renovatebot.com/diffs/npm/puppeteer-core/22.8.2/24.22.3) | [![age](https://developer.mend.io/api/mc/badges/age/npm/puppeteer-core/24.22.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/puppeteer-core/22.8.2/24.22.3?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [react-is](https://react.dev/) ([source](https://redirect.github.com/facebook/react/tree/HEAD/packages/react-is)) | [`~19.0.0` -> `~19.1.0`](https://renovatebot.com/diffs/npm/react-is/19.0.0/19.1.1) | [![age](https://developer.mend.io/api/mc/badges/age/npm/react-is/19.1.1?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/react-is/19.0.0/19.1.1?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [rsc-html-stream](https://redirect.github.com/devongovett/rsc-html-stream) | [`0.0.6` -> `0.0.7`](https://renovatebot.com/diffs/npm/rsc-html-stream/0.0.6/0.0.7) | [![age](https://developer.mend.io/api/mc/badges/age/npm/rsc-html-stream/0.0.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/rsc-html-stream/0.0.6/0.0.7?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [ts-morph](https://redirect.github.com/dsherret/ts-morph) | [`~25.0.1` -> `~27.0.0`](https://renovatebot.com/diffs/npm/ts-morph/25.0.1/27.0.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/ts-morph/27.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/ts-morph/25.0.1/27.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [tsx](https://tsx.is) ([source](https://redirect.github.com/privatenumber/tsx)) | [`~4.19.4` -> `~4.20.0`](https://renovatebot.com/diffs/npm/tsx/4.19.4/4.20.5) | [![age](https://developer.mend.io/api/mc/badges/age/npm/tsx/4.20.5?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/tsx/4.19.4/4.20.5?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [typescript](https://www.typescriptlang.org/) ([source](https://redirect.github.com/microsoft/TypeScript)) | [`~5.8.3` -> `~5.9.0`](https://renovatebot.com/diffs/npm/typescript/5.8.3/5.9.2) | [![age](https://developer.mend.io/api/mc/badges/age/npm/typescript/5.9.2?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/typescript/5.8.3/5.9.2?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [vibe-rules](https://redirect.github.com/FutureExcited/vibe-rules) | [`~0.2.31` -> `~0.3.0`](https://renovatebot.com/diffs/npm/vibe-rules/0.2.31/0.3.91) | [![age](https://developer.mend.io/api/mc/badges/age/npm/vibe-rules/0.3.91?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vibe-rules/0.2.31/0.3.91?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [vitest](https://redirect.github.com/vitest-dev/vitest) ([source](https://redirect.github.com/vitest-dev/vitest/tree/HEAD/packages/vitest)) | [`~3.1.1` -> `~3.2.0`](https://renovatebot.com/diffs/npm/vitest/3.1.1/3.2.4) | [![age](https://developer.mend.io/api/mc/badges/age/npm/vitest/3.2.4?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/vitest/3.1.1/3.2.4?slim=true)](https://docs.renovatebot.com/merge-confidence/) |

---

> [!WARNING]
> Some dependencies could not be looked up. Check the Dependency Dashboard for more information.

This PR updates the following dependencies:

---

### Release Notes

<details>
<summary>ast-grep/ast-grep (@&#8203;ast-grep/napi)</summary>

### [`v0.39.5`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0395)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.39.4...0.39.5)

- Allowing LSP clients without publish diagnostics data support to support code fixes [`#2209`](https://redirect.github.com/ast-grep/ast-grep/pull/2209)
- fix: store client cap and do not send workspace folder req [`#2211`](https://redirect.github.com/ast-grep/ast-grep/issues/2211)
- fix: comment after node should be ignored in strictness=relax [`#2216`](https://redirect.github.com/ast-grep/ast-grep/issues/2216)
- fix: apply\_all\_code\_actions function disallow multi-line [`#2222`](https://redirect.github.com/ast-grep/ast-grep/issues/2222)
- chore(deps): update dependency oxlint to v1.13.0 [`4be8252`](https://redirect.github.com/ast-grep/ast-grep/commit/4be8252ed739a663f1a751e654ee150312fdfba3)
- chore(deps): update dependency [@&#8203;ast-grep/napi](https://redirect.github.com/ast-grep/napi) to v0.39.4 [`3187d39`](https://redirect.github.com/ast-grep/ast-grep/commit/3187d393a60e503c45cd16151429db45d3347ec4)
- chore(deps): update dependency oxlint to v1.14.0 [`7405f99`](https://redirect.github.com/ast-grep/ast-grep/commit/7405f9935e8038e077efeb02a3f6ab1b9014dc6b)

### [`v0.39.4`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0394)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.39.3...0.39.4)

> 16 August 2025

- Improve error messages for ast-grep test failures based on failure type [`#2174`](https://redirect.github.com/ast-grep/ast-grep/pull/2174)
- Add comprehensive GitHub Copilot development instructions [`#2152`](https://redirect.github.com/ast-grep/ast-grep/pull/2152)
- Address all code review comments: move make\_rule\_finder to lsp.rs, simplify logic, reduce indentation, update file watchers, remove unused deps [`8ef8ed6`](https://redirect.github.com/ast-grep/ast-grep/commit/8ef8ed63490b379f7cee54ad0cf6ff9e8d557016)
- Decouple rule finding logic from LSP crate as requested [`531aac3`](https://redirect.github.com/ast-grep/ast-grep/commit/531aac39f2465a0f53a32e437838895e637f0105)
- Complete LSP rule reloading implementation with tests [`683f20e`](https://redirect.github.com/ast-grep/ast-grep/commit/683f20eb8d3adcbfc525ad1c640413dcbf2d6bd9)

### [`v0.39.3`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0393)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.39.2...0.39.3)

> 5 August 2025

- add some tests for hcl [`756499e`](https://redirect.github.com/ast-grep/ast-grep/commit/756499eab0e895fbc5641a83a9dc53c341ad82b5)
- add tree-sitter-hcl to ast-grep-language package deps [`26b638a`](https://redirect.github.com/ast-grep/ast-grep/commit/26b638ac2dc997ac88f564ec4923bb36fb588a50)
- fix(deps): update rust crate clap to v4.5.42 [`4d047eb`](https://redirect.github.com/ast-grep/ast-grep/commit/4d047ebad029c2fc53176ba51d8929986efd42f1)

### [`v0.39.2`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0392)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.39.1...0.39.2)

> 27 July 2025

- fix(deps): update rust crate tokio to v1.47.0 [`#2124`](https://redirect.github.com/ast-grep/ast-grep/pull/2124)
- fix: ignore comments in relax/signature/template strictness [`#2122`](https://redirect.github.com/ast-grep/ast-grep/issues/2122)
- fix: prefer using env to determine bgcolor [`#2114`](https://redirect.github.com/ast-grep/ast-grep/issues/2114)
- fix: update rules [`c5fd340`](https://redirect.github.com/ast-grep/ast-grep/commit/c5fd34000af4cee2d74234e60649c7f81d97ca05)
- chore(deps): update dependency [@&#8203;napi-rs/cli](https://redirect.github.com/napi-rs/cli) to v3.0.4 [`b07e5bd`](https://redirect.github.com/ast-grep/ast-grep/commit/b07e5bd74cfa5c92dc336528b1b8fe5288d9173c)
- fix: temporarily remove tweaking [`d2fedd2`](https://redirect.github.com/ast-grep/ast-grep/commit/d2fedd2a7ab82109baf07216241af25164ce9f7e)

### [`v0.39.1`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0391)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.38.7...0.39.1)

> 20 July 2025

- fix: update package [`8c2327b`](https://redirect.github.com/ast-grep/ast-grep/commit/8c2327b247dbe3b218a7a888480a7cf0ad765fb4)
- fix: fix build [`d59c219`](https://redirect.github.com/ast-grep/ast-grep/commit/d59c219299af827da11a52f9e7f8ffbbb3ebaeb8)
- fix: remove json format [`90369a4`](https://redirect.github.com/ast-grep/ast-grep/commit/90369a4cf698e8d3cbdc9c872f852c277588521b)

### [`v0.38.7`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0387)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.38.6...0.38.7)

> 9 July 2025

- refactor: remove biome configuration and update linting tool to oxlint [`ed3e5b1`](https://redirect.github.com/ast-grep/ast-grep/commit/ed3e5b1197b1ebec1533021fd446366eac0d2408)
- chore(deps): update dependency [@&#8203;ast-grep/napi](https://redirect.github.com/ast-grep/napi) to v0.38.6 [`9e5f1e0`](https://redirect.github.com/ast-grep/ast-grep/commit/9e5f1e070aed4557f998db0c4cab97f4aead9fbe)
- Revert "fix(deps): update rust crate tower-lsp-server to 0.22.0" [`7d8e872`](https://redirect.github.com/ast-grep/ast-grep/commit/7d8e872b5b4aea3bd5d1c3f7311d375378e8181a)

### [`v0.38.6`](https://redirect.github.com/ast-grep/ast-grep/blob/HEAD/CHANGELOG.md#0386)

[Compare Source](https://redirect.github.com/ast-grep/ast-grep/compare/0.38.5...0.38.6)

> 23 June 2025

- fix(deps): update rust crate tower-lsp-server to 0.22.0 [`#2056`](https://redirect.github.com/ast-grep/ast-grep/pull/2056)
- feat: allow sgconfig.yml to not have required ruleDirs field [`#2059`](https://redirect.github.com/ast-grep/ast-grep/issues/2059)
- fix: ast-grep -h should not fail if sgconfig is wrong [`#2054`](https://redirect.github.com/ast-grep/ast-grep/issues/2054)
- chore(deps): update dependency [@&#8203;ast-grep/napi](https://redirect.github.com/ast-grep/napi) to v0.38.5 [`c7a41d6`](https://redirect.github.com/ast-grep/ast-grep/commit/c7a41d62bde99f734a31ac4b325a3a4e25a9c8fe)
- Revert "fix(deps): update rust crate tower-lsp-server to 0.22.0 ([#&#8203;2056](https://redirect.github.com/ast-grep/ast-grep/issues/2056))" [`a5a011b`](https://redirect.github.com/ast-grep/ast-grep/commit/a5a011b3c6add149df9da410ae5a272f96832019)
- fix(deps): update rust crate toml\_edit to v0.22.27 [`84cff96`](https://redirect.github.com/ast-grep/ast-grep/commit/84cff969999aae84b10bc5de17a739a636a4afb7)

</details>

<details>
<summary>cloudflare/workerd (@&#8203;cloudflare/workers-types)</summary>

### [`v4.20250924.0`](https://redirect.github.com/cloudflare/workerd/compare/014ae2c19c404332c94b45d9481c50787f44b46d...c9116354454265cf09a472771646d848e3e0fa9f)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/014ae2c19c404332c94b45d9481c50787f44b46d...c9116354454265cf09a472771646d848e3e0fa9f)

### [`v4.20250923.0`](https://redirect.github.com/cloudflare/workerd/compare/9224be88acb313719693d283a44511c2165d7fb0...014ae2c19c404332c94b45d9481c50787f44b46d)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/9224be88acb313719693d283a44511c2165d7fb0...014ae2c19c404332c94b45d9481c50787f44b46d)

### [`v4.20250922.0`](https://redirect.github.com/cloudflare/workerd/compare/1db98ae93ad97c00283e87bbeb14c93f10c1dae6...9224be88acb313719693d283a44511c2165d7fb0)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/1db98ae93ad97c00283e87bbeb14c93f10c1dae6...9224be88acb313719693d283a44511c2165d7fb0)

### [`v4.20250921.0`](https://redirect.github.com/cloudflare/workerd/compare/c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6...1db98ae93ad97c00283e87bbeb14c93f10c1dae6)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6...1db98ae93ad97c00283e87bbeb14c93f10c1dae6)

### [`v4.20250920.0`](https://redirect.github.com/cloudflare/workerd/compare/7b6621d94ced05981d04b88f894ba617985e086c...c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/7b6621d94ced05981d04b88f894ba617985e086c...c0dfafd4a4cc755dd6ab5c524ecbbd2f14dd21f6)

### [`v4.20250919.0`](https://redirect.github.com/cloudflare/workerd/compare/f0c91b22361c02328bfdf5053c5380598f26f67c...7b6621d94ced05981d04b88f894ba617985e086c)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/f0c91b22361c02328bfdf5053c5380598f26f67c...7b6621d94ced05981d04b88f894ba617985e086c)

### [`v4.20250918.0`](https://redirect.github.com/cloudflare/workerd/compare/84b597aca73b45f38a61c131f388ee26a64cf145...f0c91b22361c02328bfdf5053c5380598f26f67c)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/84b597aca73b45f38a61c131f388ee26a64cf145...f0c91b22361c02328bfdf5053c5380598f26f67c)

### [`v4.20250917.0`](https://redirect.github.com/cloudflare/workerd/compare/182098fbaa2df43c2ae0299affa9ce68fe007b89...84b597aca73b45f38a61c131f388ee26a64cf145)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/182098fbaa2df43c2ae0299affa9ce68fe007b89...84b597aca73b45f38a61c131f388ee26a64cf145)

### [`v4.20250913.0`](https://redirect.github.com/cloudflare/workerd/compare/a136b6615988a7a8f4d98c44dfddd1f769abe350...182098fbaa2df43c2ae0299affa9ce68fe007b89)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/a136b6615988a7a8f4d98c44dfddd1f769abe350...182098fbaa2df43c2ae0299affa9ce68fe007b89)

### [`v4.20250912.0`](https://redirect.github.com/cloudflare/workerd/compare/07d3c6c0194d90c015d71fee06282c4473ee20c4...a136b6615988a7a8f4d98c44dfddd1f769abe350)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/07d3c6c0194d90c015d71fee06282c4473ee20c4...a136b6615988a7a8f4d98c44dfddd1f769abe350)

### [`v4.20250911.0`](https://redirect.github.com/cloudflare/workerd/compare/3e1894b39987fa9f0b0ad93e24a34eb3a2afdb1c...07d3c6c0194d90c015d71fee06282c4473ee20c4)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/3e1894b39987fa9f0b0ad93e24a34eb3a2afdb1c...07d3c6c0194d90c015d71fee06282c4473ee20c4)

### [`v4.20250910.0`](https://redirect.github.com/cloudflare/workerd/compare/c91e0649b40a884f3d9cea8a845f7305640821cf...3e1894b39987fa9f0b0ad93e24a34eb3a2afdb1c)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/c91e0649b40a884f3d9cea8a845f7305640821cf...3e1894b39987fa9f0b0ad93e24a34eb3a2afdb1c)

### [`v4.20250909.0`](https://redirect.github.com/cloudflare/workerd/compare/e59e1f409639c09472f8c2f6cbaaf48823a5e898...c91e0649b40a884f3d9cea8a845f7305640821cf)

[Compare Source](https://redirect.github.com/cloudflare/workerd/compare/e59e1f409639c09472f8c2f6cbaaf48823a5e898...c91e0649b40a884f3d9cea8a845f7305640821cf)

</details>

<details>
<summary>puppeteer/puppeteer (@&#8203;puppeteer/browsers)</summary>

### [`v2.10.10`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24210-2025-09-15)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/e9998aa9f7cdc7a3eecc1ab08c69fc6da29c37ed...fcbfb730b8abb9412ce797ccfd0e1579d4e1d490)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.9 to 2.10.10

##### Features

- emulate `navigator.platform` in `Page.setUserAgent` ([#&#8203;14190](https://redirect.github.com/puppeteer/puppeteer/issues/14190)) ([a2397a6](https://redirect.github.com/puppeteer/puppeteer/commit/a2397a616930ead735c9ae5d8bae5801cd97f62a))

##### Bug Fixes

- always pipe stdio and report process launch errors ([#&#8203;14210](https://redirect.github.com/puppeteer/puppeteer/issues/14210)) ([c17a64b](https://redirect.github.com/puppeteer/puppeteer/commit/c17a64bd6880549c7fe5123592a7270b1d1101df))
- do not change CDP state if interception was not toggled ([#&#8203;14203](https://redirect.github.com/puppeteer/puppeteer/issues/14203)) ([a4f166a](https://redirect.github.com/puppeteer/puppeteer/commit/a4f166a1c873623d02f468522f4ace338819a35d))

### [`v2.10.9`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24210-2025-09-15)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/5bedba6c1e7000bdd8fe36a79eccf2858ac8b1fe...e9998aa9f7cdc7a3eecc1ab08c69fc6da29c37ed)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.9 to 2.10.10

##### Features

- emulate `navigator.platform` in `Page.setUserAgent` ([#&#8203;14190](https://redirect.github.com/puppeteer/puppeteer/issues/14190)) ([a2397a6](https://redirect.github.com/puppeteer/puppeteer/commit/a2397a616930ead735c9ae5d8bae5801cd97f62a))

##### Bug Fixes

- always pipe stdio and report process launch errors ([#&#8203;14210](https://redirect.github.com/puppeteer/puppeteer/issues/14210)) ([c17a64b](https://redirect.github.com/puppeteer/puppeteer/commit/c17a64bd6880549c7fe5123592a7270b1d1101df))
- do not change CDP state if interception was not toggled ([#&#8203;14203](https://redirect.github.com/puppeteer/puppeteer/issues/14203)) ([a4f166a](https://redirect.github.com/puppeteer/puppeteer/commit/a4f166a1c873623d02f468522f4ace338819a35d))

### [`v2.10.8`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24200-2025-09-10)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/31d25c7fdb5b5d400d62c4b7bd824f142c884d83...5bedba6c1e7000bdd8fe36a79eccf2858ac8b1fe)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.8 to 2.10.9

##### Features

- add Browser.deleteMatchingCookies() method ([#&#8203;14175](https://redirect.github.com/puppeteer/puppeteer/issues/14175)) ([925460d](https://redirect.github.com/puppeteer/puppeteer/commit/925460d4c888522088952b0b001b1ec6b9ed9968))
- support offline parameter in emulateNetworkConditions ([#&#8203;14184](https://redirect.github.com/puppeteer/puppeteer/issues/14184)) ([79c47f4](https://redirect.github.com/puppeteer/puppeteer/commit/79c47f4885a691d578209a84d98b73e2c2fb73a0))

##### Bug Fixes

- **accessibility:** reports snapshot with uninteresting root and focusable Document is not a leaf node ([#&#8203;14169](https://redirect.github.com/puppeteer/puppeteer/issues/14169)) ([3bad7ad](https://redirect.github.com/puppeteer/puppeteer/commit/3bad7ad2240647d57ae327fc12b0e7deff8d95e8))
- roll to Chrome 140.0.7339.82 ([#&#8203;14182](https://redirect.github.com/puppeteer/puppeteer/issues/14182)) ([7e4440d](https://redirect.github.com/puppeteer/puppeteer/commit/7e4440d706dfa62b2a011dedb8d87c4189f397b3))

### [`v2.10.7`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24171-2025-08-28)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/3d72c43a2d2a681a44d1f96c3c6432b6a75ac8e5...31d25c7fdb5b5d400d62c4b7bd824f142c884d83)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.7 to 2.10.8

##### Bug Fixes

- add better stack trace to LifecycleWatcher ([#&#8203;14137](https://redirect.github.com/puppeteer/puppeteer/issues/14137)) ([0c9fd4f](https://redirect.github.com/puppeteer/puppeteer/commit/0c9fd4f0d188842a04682561270ea7c91402dca2))
- roll to Chrome 139.0.7258.154 ([#&#8203;14144](https://redirect.github.com/puppeteer/puppeteer/issues/14144)) ([51033e3](https://redirect.github.com/puppeteer/puppeteer/commit/51033e358a8bd65eb7aa2b3379d0a9ec12d50859))
- roll to Firefox 142.0.1 ([#&#8203;14145](https://redirect.github.com/puppeteer/puppeteer/issues/14145)) ([b321cd0](https://redirect.github.com/puppeteer/puppeteer/commit/b321cd0c8bf7d4c4b9c618dbab49ad39c8d89cfe))
- standardize error handling for closed connections ([#&#8203;14135](https://redirect.github.com/puppeteer/puppeteer/issues/14135)) ([d4478a1](https://redirect.github.com/puppeteer/puppeteer/commit/d4478a127db373645a6960527e495aa52457c42e))

### [`v2.10.6`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24170-2025-08-20)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/efc1343e24247225428e0602471c57396ac31857...3d72c43a2d2a681a44d1f96c3c6432b6a75ac8e5)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.6 to 2.10.7

##### Features

- roll to Firefox 142.0 ([#&#8203;14127](https://redirect.github.com/puppeteer/puppeteer/issues/14127)) ([f00517e](https://redirect.github.com/puppeteer/puppeteer/commit/f00517ef4aad3ccfd9afb2e00114baa13ea71cc4))
- **webdriver:** implement `Page.setJavaScriptEnabled` ([#&#8203;14118](https://redirect.github.com/puppeteer/puppeteer/issues/14118)) ([fb55e8f](https://redirect.github.com/puppeteer/puppeteer/commit/fb55e8fe26aa6be6ed7edb235f5914d0bab641c3))

##### Bug Fixes

- roll to Chrome 139.0.7258.138 ([#&#8203;14125](https://redirect.github.com/puppeteer/puppeteer/issues/14125)) ([b1d2a54](https://redirect.github.com/puppeteer/puppeteer/commit/b1d2a541815bd0010039ab1f8f269865ce5897be))

### [`v2.10.5`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24140-2025-07-16)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/9e4619daea05d1990209157107eed68d54ab611d...efc1343e24247225428e0602471c57396ac31857)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.5 to 2.10.6

##### Features

- add debugging highlight to ElementHandle.click() ([#&#8203;14024](https://redirect.github.com/puppeteer/puppeteer/issues/14024)) ([8c4d87a](https://redirect.github.com/puppeteer/puppeteer/commit/8c4d87af17aceb0a25aecc85819f4258f717b944))

##### Bug Fixes

- roll to Chrome 138.0.7204.157 ([#&#8203;14029](https://redirect.github.com/puppeteer/puppeteer/issues/14029)) ([2a733b4](https://redirect.github.com/puppeteer/puppeteer/commit/2a733b401f688ea1e74b0e8af65c7399021db1ea))
- **webdriver:** provide proper exception while accessing response in BiDi ([#&#8203;14031](https://redirect.github.com/puppeteer/puppeteer/issues/14031)) ([9150473](https://redirect.github.com/puppeteer/puppeteer/commit/915047341b779a580be07552d853c88c6b306603))

### [`v2.10.4`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#2490-2025-05-20)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/5fcbb11a53b883c3688bdb0dc1fe42ccf9263338...9e4619daea05d1990209157107eed68d54ab611d)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.4 to 2.10.5

##### Features

- add `screencast` override options ([#&#8203;13708](https://redirect.github.com/puppeteer/puppeteer/issues/13708)) ([e3586e8](https://redirect.github.com/puppeteer/puppeteer/commit/e3586e81521e0d91d4d69990cc44a73504dea3c4))

##### Bug Fixes

- roll to Chrome 136.0.7103.94 ([#&#8203;13870](https://redirect.github.com/puppeteer/puppeteer/issues/13870)) ([9c6ef13](https://redirect.github.com/puppeteer/puppeteer/commit/9c6ef1345633b3576b3ef433dafdc6dcb9c1424f))
- roll to Firefox 138.0.3 ([#&#8203;13868](https://redirect.github.com/puppeteer/puppeteer/issues/13868)) ([863a3e0](https://redirect.github.com/puppeteer/puppeteer/commit/863a3e07dcce874035d851778ae4187e12ef421b))
- roll to Firefox 138.0.4 ([#&#8203;13881](https://redirect.github.com/puppeteer/puppeteer/issues/13881)) ([29ff2b5](https://redirect.github.com/puppeteer/puppeteer/commit/29ff2b59815c543c95e7458b7f8ba7ad72afd71c))

### [`v2.10.3`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#2482-2025-05-07)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/98fe5581cb679b3018a296700e635abad7a2c88a...5fcbb11a53b883c3688bdb0dc1fe42ccf9263338)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.3 to 2.10.4

##### Bug Fixes

- roll to Chrome 136.0.7103.92 ([#&#8203;13854](https://redirect.github.com/puppeteer/puppeteer/issues/13854)) ([a83e6ce](https://redirect.github.com/puppeteer/puppeteer/commit/a83e6ce79729a99a4d7c8eb834aa645869185664))

### [`v2.10.2`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#2480-2025-05-02)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/61a5536442d8b9141b6961afe0a183b4aabee38a...98fe5581cb679b3018a296700e635abad7a2c88a)

##### Features

- Add `enableExtensions` launch option ([#&#8203;13824](https://redirect.github.com/puppeteer/puppeteer/issues/13824)) ([fd948cf](https://redirect.github.com/puppeteer/puppeteer/commit/fd948cfd9dece93233b8ed636af1447f8fb44f4e))
- Add Browser.installExtension and Browser.uninstallExtension ([#&#8203;13810](https://redirect.github.com/puppeteer/puppeteer/issues/13810)) ([7b9c72c](https://redirect.github.com/puppeteer/puppeteer/commit/7b9c72c984ba14b78d94235bd3ac41e0848a96a0))
- roll to Chrome 136.0.7103.49 ([#&#8203;13828](https://redirect.github.com/puppeteer/puppeteer/issues/13828)) ([ad4a6e7](https://redirect.github.com/puppeteer/puppeteer/commit/ad4a6e76c6846d98d9f6c4e81cbab71c4284a124))
- roll to Firefox 138.0 ([#&#8203;13829](https://redirect.github.com/puppeteer/puppeteer/issues/13829)) ([b3f04d7](https://redirect.github.com/puppeteer/puppeteer/commit/b3f04d7e65319d61f88d04f74d215c452292e222))

##### Bug Fixes

- roll to Firefox 138.0.1 ([#&#8203;13832](https://redirect.github.com/puppeteer/puppeteer/issues/13832)) ([bfa0e39](https://redirect.github.com/puppeteer/puppeteer/commit/bfa0e39a3bdee567e0df87d65d76494139c3a18c))
- writable stream in PipeTransport should handle errors ([#&#8203;13825](https://redirect.github.com/puppeteer/puppeteer/issues/13825)) ([da97da5](https://redirect.github.com/puppeteer/puppeteer/commit/da97da5731a7d246118c74d69baea23eeaf3a7f6))

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.2 to 2.10.3

### [`v2.10.1`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#24210-2025-09-15)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/45a289e1fb8b6337c5ff336a33345308fe4e9e9a...61a5536442d8b9141b6961afe0a183b4aabee38a)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.9 to 2.10.10

##### Features

- emulate `navigator.platform` in `Page.setUserAgent` ([#&#8203;14190](https://redirect.github.com/puppeteer/puppeteer/issues/14190)) ([a2397a6](https://redirect.github.com/puppeteer/puppeteer/commit/a2397a616930ead735c9ae5d8bae5801cd97f62a))

##### Bug Fixes

- always pipe stdio and report process launch errors ([#&#8203;14210](https://redirect.github.com/puppeteer/puppeteer/issues/14210)) ([c17a64b](https://redirect.github.com/puppeteer/puppeteer/commit/c17a64bd6880549c7fe5123592a7270b1d1101df))
- do not change CDP state if interception was not toggled ([#&#8203;14203](https://redirect.github.com/puppeteer/puppeteer/issues/14203)) ([a4f166a](https://redirect.github.com/puppeteer/puppeteer/commit/a4f166a1c873623d02f468522f4ace338819a35d))

### [`v2.10.0`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#2470-2025-04-22)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/db9c7bb5df84e9c5702fc285824ac554d861b7f9...45a289e1fb8b6337c5ff336a33345308fe4e9e9a)

##### Bug Fixes

- roll to Chrome 135.0.7049.95 ([#&#8203;13788](https://redirect.github.com/puppeteer/puppeteer/issues/13788)) ([f2f37b5](https://redirect.github.com/puppeteer/puppeteer/commit/f2f37b5a3cbfba9a0279f6ff47a424170575ed3c))
- roll to Firefox 137.0.2 ([#&#8203;13789](https://redirect.github.com/puppeteer/puppeteer/issues/13789)) ([192ce96](https://redirect.github.com/puppeteer/puppeteer/commit/192ce9676c312c551b24cd732c15b590c5243fb6))

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.10.0 to 2.10.1

##### Features

- support network requests for workers ([#&#8203;13752](https://redirect.github.com/puppeteer/puppeteer/issues/13752)) ([4062068](https://redirect.github.com/puppeteer/puppeteer/commit/4062068da9fd839008ef78411432de26ad367bda))
- **webdriver:** support FileChooser with WebDriver BiDi ([#&#8203;13780](https://redirect.github.com/puppeteer/puppeteer/issues/13780)) ([a4d0d34](https://redirect.github.com/puppeteer/puppeteer/commit/a4d0d34643ef1dce173a0a927a4016ee99521ac4))
- **webdriver:** support geolocation emulation ([#&#8203;13773](https://redirect.github.com/puppeteer/puppeteer/issues/13773)) ([74eefd8](https://redirect.github.com/puppeteer/puppeteer/commit/74eefd82786e6b2b59d4d8ef6989404536d3463f))

### [`v2.9.0`](https://redirect.github.com/puppeteer/puppeteer/blob/HEAD/CHANGELOG.md#2461-2025-04-09)

[Compare Source](https://redirect.github.com/puppeteer/puppeteer/compare/842075f7dafd8853d73552436dcf9130845d80ca...db9c7bb5df84e9c5702fc285824ac554d861b7f9)

##### Miscellaneous Chores

- **puppeteer:** Synchronize puppeteer versions

##### Dependencies

- The following workspace dependencies were updated
  - dependencies
    - [@&#8203;puppeteer/browsers](https://redirect.github.com/puppeteer/browsers) bumped from 2.9.0 to 2.10.0

##### Bug Fixes

- optimize base64 decoding ([#&#8203;13753](https://redirect.github.com/puppeteer/puppeteer/issues/13753)) ([8145dd6](https://redirect.github.com/puppeteer/puppeteer/commit/8145dd64f21ca7ab917c9c75fe51d04a9463b552))
- roll to Chrome 135.0.7049.84 ([#&#8203;13756](https://redirect.github.com/puppeteer/puppeteer/issues/13756)) ([ab6459f](https://redirect.github.com/puppeteer/puppeteer/commit/ab6459f947471645445a71afbe5d7b4755cb9cf7))
- roll to Firefox 137.0.1 ([#&#8203;13758](https://redirect.github.com/puppeteer/puppeteer/issues/13758)) ([446a07c](https://redirect.github.com/puppeteer/puppeteer/commit/446a07cdc4e56f8a926f74d167cb14eca24a9602))
- **webdriver:** handle errors if exposed function args are no longer available ([#&#8203;13759](https://redirect.github.com/puppeteer/puppeteer/issues/13759)) ([4013556](https://redirect.github.com/puppeteer/puppeteer/commit/401355610874beac23a51dcb75739a4bb4191a2b))

</details>

<details>
<summary>vitejs/vite-plugin-react (@&#8203;vitejs/plugin-react)</summary>

### [`v5.0.3`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#503-2025-09-17)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/1f4b4d9523c0cbdba66724e83477309ef65cac96...8293cb38945e56729b5b045b09858da6b78ba3a3)

##### HMR did not work for components imported with queries with rolldown-vite ([#&#8203;872](https://redirect.github.com/vitejs/vite-plugin-react/pull/872))

##### Perf: simplify refresh wrapper generation ([#&#8203;835](https://redirect.github.com/vitejs/vite-plugin-react/pull/835))

### [`v5.0.2`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#502-2025-08-28)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/efe434417542cdbfbb00503d4c35ffbba49d3efa...1f4b4d9523c0cbdba66724e83477309ef65cac96)

##### Skip transform hook completely in rolldown-vite in dev if possible ([#&#8203;783](https://redirect.github.com/vitejs/vite-plugin-react/pull/783))

### [`v5.0.1`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#501-2025-08-19)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/9e4a94428dae6d39ccc13e0220f2abc7a76aeb5e...efe434417542cdbfbb00503d4c35ffbba49d3efa)

##### Set `optimizeDeps.rollupOptions.transform.jsx` instead of `optimizeDeps.rollupOptions.jsx` for rolldown-vite ([#&#8203;735](https://redirect.github.com/vitejs/vite-plugin-react/pull/735))

`optimizeDeps.rollupOptions.jsx` is going to be deprecated in favor of `optimizeDeps.rollupOptions.transform.jsx`.

##### Perf: skip `babel-plugin-react-compiler` if code has no `"use memo"` when `{ compilationMode: "annotation" }` ([#&#8203;734](https://redirect.github.com/vitejs/vite-plugin-react/pull/734))

##### Respect tsconfig `jsxImportSource` ([#&#8203;726](https://redirect.github.com/vitejs/vite-plugin-react/pull/726))

##### Fix `reactRefreshHost` option on rolldown-vite ([#&#8203;716](https://redirect.github.com/vitejs/vite-plugin-react/pull/716))

##### Fix `RefreshRuntime` being injected twice for class components on rolldown-vite ([#&#8203;708](https://redirect.github.com/vitejs/vite-plugin-react/pull/708))

##### Skip `babel-plugin-react-compiler` on non client environment ([689](https://redirect.github.com/vitejs/vite-plugin-react/pull/689))

### [`v5.0.0`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#500-2025-08-07)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/80417060f7bc239d5100e1b47c819e8364c7d551...9e4a94428dae6d39ccc13e0220f2abc7a76aeb5e)

### [`v4.7.0`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#470-2025-07-18)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/12bd153622731890678e43367e30c4a212d74376...80417060f7bc239d5100e1b47c819e8364c7d551)

##### Add HMR support for compound components ([#&#8203;518](https://redirect.github.com/vitejs/vite-plugin-react/pull/518))

HMR now works for compound components like this:

```tsx
const Root = () => <div>Accordion Root</div>
const Item = () => <div>Accordion Item</div>

export const Accordion = { Root, Item }
```

##### Return `Plugin[]` instead of `PluginOption[]` ([#&#8203;537](https://redirect.github.com/vitejs/vite-plugin-react/pull/537))

The return type has changed from `react(): PluginOption[]` to more specialized type `react(): Plugin[]`. This allows for type-safe manipulation of plugins, for example:

```tsx
// previously this causes type errors
react({ babel: { plugins: ['babel-plugin-react-compiler'] } })
  .map(p => ({ ...p, applyToEnvironment: e => e.name === 'client' }))
```

### [`v4.6.0`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#460-2025-06-23)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/bfb45addb83ebae8feebdb75be2e07ce27e916cb...12bd153622731890678e43367e30c4a212d74376)

##### Add raw Rolldown support

This plugin only worked with Vite. But now it can also be used with raw Rolldown. The main purpose for using this plugin with Rolldown is to use react compiler.

### [`v4.5.2`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#452-2025-06-10)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/2f3205265904ff7770021700689a0d6fe17b1f03...bfb45addb83ebae8feebdb75be2e07ce27e916cb)

##### Suggest `@vitejs/plugin-react-oxc` if rolldown-vite is detected [#&#8203;491](https://redirect.github.com/vitejs/vite-plugin-react/pull/491)

Emit a log which recommends `@vitejs/plugin-react-oxc` when `rolldown-vite` is detected to improve performance and use Oxc under the hood. The warning can be disabled by setting `disableOxcRecommendation: false` in the plugin options.

##### Use `optimizeDeps.rollupOptions` instead of `optimizeDeps.esbuildOptions` for rolldown-vite [#&#8203;489](https://redirect.github.com/vitejs/vite-plugin-react/pull/489)

This suppresses the warning about `optimizeDeps.esbuildOptions` being deprecated in rolldown-vite.

##### Add Vite 7-beta to peerDependencies range [#&#8203;497](https://redirect.github.com/vitejs/vite-plugin-react/pull/497)

React plugins are compatible with Vite 7, this removes the warning when testing the beta.

### [`v4.5.1`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#451-2025-06-03)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/476e705375ef618458918580beb63f43799d12e4...2f3205265904ff7770021700689a0d6fe17b1f03)

##### Add explicit semicolon in preambleCode [#&#8203;485](https://redirect.github.com/vitejs/vite-plugin-react/pull/485)

This fixes an edge case when using HTML minifiers that strips line breaks aggressively.

### [`v4.5.0`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#450-2025-05-23)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/57cc39869c319b842dac348b62c882a7bb963f7b...476e705375ef618458918580beb63f43799d12e4)

##### Add `filter` for rolldown-vite [#&#8203;470](https://redirect.github.com/vitejs/vite-plugin-react/pull/470)

Added `filter` so that it is more performant when running this plugin with rolldown-powered version of Vite.

##### Skip HMR for JSX files with hooks [#&#8203;480](https://redirect.github.com/vitejs/vite-plugin-react/pull/480)

This removes the HMR warning for hooks with JSX.

### [`v4.4.1`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#441-2025-04-19)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/8beda4f36fe4ca8c0f795619988deb0849054f8c...57cc39869c319b842dac348b62c882a7bb963f7b)

Fix type issue when using `moduleResolution: "node"` in tsconfig [#&#8203;462](https://redirect.github.com/vitejs/vite-plugin-react/pull/4620)

### [`v4.4.0`](https://redirect.github.com/vitejs/vite-plugin-react/blob/HEAD/packages/plugin-react/CHANGELOG.md#440-2025-04-15)

[Compare Source](https://redirect.github.com/vitejs/vite-plugin-react/compare/v4.3.4...8beda4f36fe4ca8c0f795619988deb0849054f8c)

##### Make compatible with rolldown-vite

This plugin is now compatible with rolldown-powered version of Vite.
Note that currently the `__source` property value position might be incorrect. This will be fixed in the near future.

</details>

<details>
<summary>paulmillr/chokidar (chokidar)</summary>

### [`v4.0.3`](https://redirect.github.com/paulmillr/chokidar/releases/tag/4.0.3)

[Compare Source](https://redirect.github.com/paulmillr/chokidar/compare/4.0.2...4.0.3)

#### What's Changed

- Fix typescript type of emitted args by [@&#8203;43081j](https://redirect.github.com/43081j) in [#&#8203;1397](https://redirect.github.com/paulmillr/chokidar/pull/1397)

**Full Changelog**: <https://github.com/paulmillr/chokidar/compare/4.0.2...4.0.3>

### [`v4.0.2`](https://redirect.github.com/paulmillr/chokidar/releases/tag/4.0.2)

[Compare Source](https://redirect.github.com/paulmillr/chokidar/compare/4.0.1...4.0.2)

#### What's Changed

- Fix test "should detect safe-edit" on FreeBSD by [@&#8203;tagattie](https://redirect.github.com/tagattie) in [#&#8203;1375](https://redirect.github.com/paulmillr/chokidar/pull/1375)
- Remove references to .map files by [@&#8203;bluwy](https://redirect.github.com/bluwy) in [#&#8203;1383](https://redirect.github.com/paulmillr/chokidar/pull/1383)
- feat: strongly type event emitter methods by [@&#8203;43081j](https://redirect.github.com/43081j) in [#&#8203;1381](https://redirect.github.com/paulmillr/chokidar/pull/1381)

#### New Contributors

- [@&#8203;bxt](https://redirect.github.com/bxt) made their first contribution in [#&#8203;1365](https://redirect.github.com/paulmillr/chokidar/pull/1365)
- [@&#8203;tagattie](https://redirect.github.com/tagattie) made their first contribution in [#&#8203;1375](https://redirect.github.com/paulmillr/chokidar/pull/1375)
- [@&#8203;bluwy](https://redirect.github.com/bluwy) made their first contribution in [#&#8203;1383](https://redirect.github.com/paulmillr/chokidar/pull/1383)

**Full Changelog**: <https://github.com/paulmillr/chokidar/compare/4.0.1...4.0.2>

### [`v4.0.1`](https://redirect.github.com/paulmillr/chokidar/releases/tag/4.0.1)

[Compare Source](https://redirect.github.com/paulmillr/chokidar/compare/4.0.0...4.0.1)

- Various fixes and improvements of typescript types

#### New Contributors

- [@&#8203;benmccann](https://redirect.github.com/benmccann) made their first contribution in [#&#8203;1349](https://redirect.github.com/paulmillr/chokidar/pull/1349)
- [@&#8203;talentlessguy](https://redirect.github.com/talentlessguy) made their first contribution in [#&#8203;1356](https://redirect.github.com/paulmillr/chokidar/pull/1356)

**Full Changelog**: <https://github.com/paulmillr/chokidar/compare/4.0.0...4.0.1>

### [`v4.0.0`](https://redirect.github.com/paulmillr/chokidar/releases/tag/4.0.0)

[Compare Source](https://redirect.github.com/paulmillr/chokidar/compare/3.6.0...4.0.0)

- Remove glob support
- Remove bundled fsevents
- Decrease dependency count from 13 to 1
- Rewrite in typescript. Makes emitted types more precise
- The package became hybrid common.js / ESM
- Bump minimum node.js requirement to v14+

Special thanks to [@&#8203;43081j](https://redirect.github.com/43081j) for improvements and help.

**Full Changelog**: <https://github.com/paulmillr/chokidar/compare/3.6.0...4.0.0>

</details>

<details>
<summary>debug-js/debug (debug)</summary>

### [`v4.4.3`](https://redirect.github.com/debug-js/debug/releases/tag/4.4.3)

[Compare Source](https://redirect.github.com/debug-js/debug/compare/4.4.1...4.4.3)

Functionally identical release to `4.4.1`.

Version `4.4.2` is **compromised**. Please see [#&#8203;1005](https://redirect.github.com/debug-js/debug/issues/1005).

</details>

<details>
<summary>sindresorhus/execa (execa)</summary>

### [`v9.6.0`](https://redirect.github.com/sindresorhus/execa/releases/tag/v9.6.0)

[Compare Source](https://redirect.github.com/sindresorhus/execa/compare/v9.5.3...v9.6.0)

- Update dependencies  [`d49104a`](https://redirect.github.com/sindresorhus/execa/commit/d49104a)

***

### [`v9.5.3`](https://redirect.github.com/sindresorhus/execa/releases/tag/v9.5.3)

[Compare Source](https://redirect.github.com/sindresorhus/execa/compare/v9.5.2...v9.5.3)

- Fix Node 24-specific deprecation warning ([#&#8203;1199](https://redirect.github.com/sindresorhus/execa/issues/1199))  [`1ac5b91`](https://redirect.github.com/sindresorhus/execa/commit/1ac5b91)

***

</details>

<details>
<summary>isaacs/node-glob (glob)</summary>

### [`v11.0.3`](https://redirect.github.com/isaacs/node-glob/compare/v11.0.2...v11.0.3)

[Compare Source](https://redirect.github.com/isaacs/node-glob/compare/v11.0.2...v11.0.3)

### [`v11.0.2`](https://redirect.github.com/isaacs/node-glob/compare/v11.0.1...v11.0.2)

[Compare Source](https://redirect.github.com/isaacs/node-glob/compare/v11.0.1...v11.0.2)

</details>

<details>
<summary>kaelzhang/node-ignore (ignore)</summary>

### [`v7.0.5`](https://redirect.github.com/kaelzhang/node-ignore/compare/7.0.4...7.0.5)

[Compare Source](https://redirect.github.com/kaelzhang/node-ignore/compare/7.0.4...7.0.5)

</details>

<details>
<summary>kysely-org/kysely (kysely)</summary>

### [`v0.28.7`](https://redirect.github.com/kysely-org/kysely/releases/tag/v0.28.7): 0.28.7

[Compare Source](https://redirect.github.com/kysely-org/kysely/compare/v0.28.6...v0.28.7)

Hey 👋

A small batch of bug fixes. Please report any issues. 🤞😰🤞

#### 🚀 Features

#### 🐞 Bugfixes

- fix: unexported dynamic builders resulting in ts(2742) when composite: true. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1578](https://redirect.github.com/kysely-org/kysely/pull/1578)
- fix(ExpressionBuilder): improper custom operator support in `eb()`. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1579](https://redirect.github.com/kysely-org/kysely/pull/1579)
- fix(TransactionBuilder): auto rollback only if transaction begun. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1580](https://redirect.github.com/kysely-org/kysely/pull/1580)

#### 📖 Documentation

#### 📦 CICD & Tooling

#### ⚠️ Breaking Changes

#### 🐤 New Contributors

**Full Changelog**: <https://github.com/kysely-org/kysely/compare/v0.28.6...v0.28.7>

### [`v0.28.6`](https://redirect.github.com/kysely-org/kysely/releases/tag/v0.28.6): 0.28.6

[Compare Source](https://redirect.github.com/kysely-org/kysely/compare/v0.28.5...v0.28.6)

Hey 👋

A small batch of bug fixes. Please report any issues. 🤞😰🤞

Docs site has been optimized and all we got was this animation:

<img width="558" height="209" alt="image" src="https://github.com/user-attachments/assets/c155839d-7e94-4e76-8d74-0d4a048ce8fd" />

##### 🚀 Features
##### 🐞 Bugfixes

##### PostgreSQL 🐘 / MSSQL 🥅

- fix(WithSchemaTransformer): using table of merge into queries unhandled. by [@&#8203;alexander-azizi-martin](https://redirect.github.com/alexander-azizi-martin) in [#&#8203;1554](https://redirect.github.com/kysely-org/kysely/pull/1554).

##### MySQL 🐬

- fix(dialect/mysql): compatibility with mysql2\@&#8203;3.14.5 by [@&#8203;jeengbe](https://redirect.github.com/jeengbe) in [#&#8203;1574](https://redirect.github.com/kysely-org/kysely/pull/1574).

##### 📖 Documentation

- docs: update site quotes section. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1546](https://redirect.github.com/kysely-org/kysely/pull/1546).
- docs: add Execution flow page, and mermaid support. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1548](https://redirect.github.com/kysely-org/kysely/pull/1548).
- docs: add kysely-supabase instructions. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1555](https://redirect.github.com/kysely-org/kysely/pull/1555).
- docs: add llms.txt and llms-full.txt. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1564](https://redirect.github.com/kysely-org/kysely/pull/1564).
- docs: add Sean's quote (Cal.com). by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`c1fd84d`](https://redirect.github.com/kysely-org/kysely/commit/c1fd84d8e29fb53265f7727913bff776af948f31).
- docs: add vercel-analytics. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`1a21140`](https://redirect.github.com/kysely-org/kysely/commit/1a21140027150fdbb53e1e52776f9d962ba117d3).
- chore(docs): remove gtag. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`98e84f1`](https://redirect.github.com/kysely-org/kysely/commit/98e84f1e3cf89f474760f87f542f482722415f29).
- feat(docs): applying google fonts optimization. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1566](https://redirect.github.com/kysely-org/kysely/pull/1566).
- chore(docs): clone packageManager property from root. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`caa22f4`](https://redirect.github.com/kysely-org/kysely/commit/caa22f49114bb1bc842e2d6686c31dfd7068f804).
- chore(docs): optimize demo video. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1567](https://redirect.github.com/kysely-org/kysely/pull/1567).
- chore(docs): preload demo poster. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`3db3542`](https://redirect.github.com/kysely-org/kysely/commit/3db354241a799ce5a4e81a9097848c56f1aece94).
- chore(docs): proper heading hierarchy. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`77eadc0`](https://redirect.github.com/kysely-org/kysely/commit/77eadc0deff9d6a313e63d8582ce78eb0a3b3070).
- chore(docs): optimize avatars. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`45a010b`](https://redirect.github.com/kysely-org/kysely/commit/45a010bcc97a622d267734fbc5dd7ccf8f0c0181).
- chore(docs): add meta description. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [`8f4dd28`](https://redirect.github.com/kysely-org/kysely/commit/8f4dd288bf65b968c45d323504a640c9a5e66dd3).
- chore(docs): add LLMs docs page. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1570](https://redirect.github.com/kysely-org/kysely/pull/1570).

##### 📦 CICD & Tooling

- chore: bump devDependencies, bump and pin github actions to commits, harden runners. by [@&#8203;igalklebanov](https://redirect.github.com/igalklebanov) in [#&#8203;1557](https://redirect.github.com/kys

</details>

---

### Configuration

📅 **Schedule**: Branch creation - "at 00:00 on sunday" (UTC), Automerge - At any time (no schedule defined).

🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.

♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.

👻 **Immortal**: This PR will be recreated if closed unmerged. Get [config help](https://redirect.github.com/renovatebot/renovate/discussions) if that's undesired.

---

 - [x] <!-- rebase-check -->If you want to rebase/retry this PR, check this box

---

This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/redwoodjs/sdk).
<!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0MS45Ny4xMCIsInVwZGF0ZWRJblZlciI6IjQxLjk3LjEwIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119-->


---

### PR #752 - fix: useId() mismatch between SSR and client side
https://github.com/redwoodjs/sdk/pull/752
Author: @justinvdm  Merged: 2025-09-21T02:30:02Z

### Context: The Previous Rendering Architecture

Previously, the framework used a single, nested rendering pass on the server to produce the initial HTML document. The user's `<Document>` component (containing the `<html>`, `<head>`, etc.) was rendered using React's standard Server-Side Rendering (SSR). As part of this same render, the framework would resolve the React Server Component (RSC) payload for the page and render its contents into the document shell.

### Problem: Non-Deterministic `useId` Generation

This approach created a hydration mismatch for client components that rely on `React.useId` (such as those in Radix UI). React's hydration for `useId` requires deterministic rendering—the sequence of hook calls that generate IDs must be identical on the server and the client.

Our single-pass architecture broke this determinism. The server would first traverse and render the components within the `<Document>` shell, advancing React's internal `useId` counter. Only then would it proceed to render the actual application components. The client, however, only hydrates the application content within the document, starting with a fresh `useId` counter. This discrepancy meant the server was performing extra rendering work that the client was unaware of, leading to a mismatch in the final IDs (e.g., server `_R_76_` vs. client `_r_0_`). This caused React to discard the server-rendered DOM, breaking interactivity and negating the benefits of SSR.

### Solution: Isolate, Render, and Stitch

The solution was to re-architect the server-side rendering pipeline to enforce context isolation. The new "Nested Renders with Stream Stitching" model works as follows:

1.  **Isolated Renders**: Instead of one nested render, we now perform two completely separate and concurrent renders on the server:
    - One for the application content, which generates an HTML stream (`appHtmlStream`). This guarantees it renders in a clean context with a fresh `useId` counter.
    - One for the `<Document>` shell, which generates another HTML stream (`documentHtmlStream`) containing a placeholder comment.
2.  **Stream Stitching**: A custom utility merges these two streams on the fly. It streams the document shell until it finds the placeholder, at which point it injects the application's complete HTML stream before continuing with the rest of the document.

This approach guarantees that the application content is rendered in an isolated context, ensuring the `useId` sequence generated on the server is identical to the one generated on the client during hydration, while at the same time ensuring streaming isn't blocked for both the document and app RSC renders.

An important secondary benefit of this change is that the user-defined `<Document>` is now a true React Server Component. This aligns with developer expectations and unlocks the full power of the RSC paradigm (e.g., using `async/await` for data fetching, accessing server-only APIs) directly within the document shell, which was not possible before. The full details of this new architecture are captured in the updated [Hybrid Rendering documentation](<./docs/architecture/hybridRscSsrRendering.md>).

---

### PR #753 - infra: Playground + E2E test infrastructure
https://github.com/redwoodjs/sdk/pull/753
Author: @justinvdm  Merged: 2025-09-20T12:49:57Z

This PR introduces a `playground` directory and a robust end-to-end (E2E) testing framework. This allows us to easily add isolated projects to test various scenarios, regressions, and features.

Each project within the `playground` can have its own E2E tests, which run against both a local dev server and a temporary production deployment on Cloudflare. The test harness provides a simple API for writing these tests:

```typescript
// playground/hello-world/__tests__/e2e.test.mts
import { expect } from "vitest";
import {
  setupPlaygroundEnvironment,
  testDevServer,
  testDeployment,
  poll,
} from "rwsdk/e2e";

// Sets up the test environment for the suite (automatic cleanup)
setupPlaygroundEnvironment();

testDevServer("renders Hello World on dev server", async ({ page, url }) => {
  await page.goto(url);
  await poll(async () => (await page.content()).includes("Hello World"));
  expect(await page.content()).toContain("Hello World");
});

testDeployment("renders Hello World on deployment", async ({ page, url }) => {
  await page.goto(url);
  await poll(async () => (await page.content()).includes("Hello World"));
  expect(await page.content()).toContain("Hello World");
});
```

Similar to our smoke tests, these playground tests are executed on CI across a matrix of supported operating systems and package managers, ensuring comprehensive validation.

For more details on how to write and run these tests, please see the ["End-to-End Tests (Playground)"](./CONTRIBUTING.md#end-to-end-tests-playground) section in the contributing guide.


---

### PR #754 - chore(deps): update pnpm to v10 [security]
https://github.com/redwoodjs/sdk/pull/754
Author: @app/renovate  Merged: 2025-09-25T11:47:21Z

chore(deps): chore(deps): update pnpm to v10 [security]

This PR contains the following updates:

| Package | Change | Age | Confidence |
|---|---|---|---|
| [pnpm](https://pnpm.io) ([source](https://redirect.github.com/pnpm/pnpm/tree/HEAD/pnpm)) | [`9.14.4+sha512.c8180b3fbe4e4bca02c94234717896b5529740a6cbadf19fa78254270403ea2f27d4e1d46a08a0f56c89b63dc8ebfd3ee53326da720273794e6200fcf0d184ab` -> `10.0.0`](https://renovatebot.com/diffs/npm/pnpm/9.14.4/10.0.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/pnpm/10.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/pnpm/9.14.4/10.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [pnpm](https://pnpm.io) ([source](https://redirect.github.com/pnpm/pnpm/tree/HEAD/pnpm)) | [`9.4.0` -> `10.0.0`](https://renovatebot.com/diffs/npm/pnpm/9.4.0/10.0.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/pnpm/10.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/pnpm/9.4.0/10.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |
| [pnpm](https://pnpm.io) ([source](https://redirect.github.com/pnpm/pnpm/tree/HEAD/pnpm)) | [`^9.4.0` -> `^10.0.0`](https://renovatebot.com/diffs/npm/pnpm/9.15.9/10.0.0) | [![age](https://developer.mend.io/api/mc/badges/age/npm/pnpm/10.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) | [![confidence](https://developer.mend.io/api/mc/badges/confidence/npm/pnpm/9.15.9/10.0.0?slim=true)](https://docs.renovatebot.com/merge-confidence/) |

---

> [!WARNING]
> Some dependencies could not be looked up. Check the Dependency Dashboard for more information.

This PR updates the following dependencies:

### GitHub Vulnerability Alerts

#### [CVE-2024-47829](https://redirect.github.com/pnpm/pnpm/security/advisories/GHSA-8cc4-rfj6-fhg4)

The path shortening function is used in pnpm：
```
export function depPathToFilename (depPath: string, maxLengthWithoutHash: number): string {
  let filename = depPathToFilenameUnescaped(depPath).replace(/[\\/:*?"<>|]/g, '+')
  if (filename.includes('(')) {
    filename = filename
      .replace(/\)$/, '')
      .replace(/(\)\()|\(|\)/g, '_')
  }
  if (filename.length > maxLengthWithoutHash || filename !== filename.toLowerCase() && !filename.startsWith('file+')) {
    return `${filename.substring(0, maxLengthWithoutHash - 27)}_${createBase32Hash(filename)}`
  }
  return filename
}
```
However, it uses the md5 function as a path shortening compression function, and if a collision occurs, it will result in the same storage path for two different libraries. Although the real names are under the package name /node_modoules/, there are no version numbers for the libraries they refer to.
![Schematic picture](https://redirect.github.com/user-attachments/assets/7b8b87ab-f297-47bd-a9dd-43be86e36ed2)
In the diagram, we assume that two packages are called packageA and packageB, and that the first 90 digits of their package names must be the same, and that the hash value of the package names with versions must be the same.  Then C is the package that they both reference, but with a different version number.  (npm allows package names up to 214 bytes, so constructing such a collision package name is obvious.)

Then hash(packageA@1.2.3)=hash(packageB@3.4.5).  This results in the same path for the installation, and thus under the same directory.  Although the package names under node_modoules are the full paths again, they are shared with C.
What is the exact version number of C?
In our local tests, it depends on which one is installed later.  If packageB is installed later, the C version number will change to 2.0.0.  At this time, although package A requires the C@1.0.0 version, package. json will only work during installation, and will not affect the actual operation.
We did not receive any installation error issues from pnpm during our local testing, nor did we use force, which is clearly a case that can be triggered.

For a package with a package name + version number longer than 120, another package can be constructed to introduce an indirect reference to a lower version, such as one with some known vulnerability.
Alternatively, it is possible to construct two packages with more than 120 package names + version numbers.
This is clearly an advantage for those intent on carrying out supply chain attacks.

The solution:
The repair cost is also very low, just need to upgrade the md5 function to sha256.

---

### Release Notes

<details>
<summary>pnpm/pnpm (pnpm)</summary>

### [`v10.0.0`](https://redirect.github.com/pnpm/pnpm/blob/HEAD/pnpm/CHANGELOG.md#1000)

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.9...v10.0.0)

##### Major Changes

- Lifecycle scripts of dependencies are not executed during installation by default! This is a breaking change aimed at increasing security. In order to allow lifecycle scripts of specific dependencies, they should be listed in the `pnpm.onlyBuiltDependencies` field of `package.json` [#&#8203;8897](https://redirect.github.com/pnpm/pnpm/pull/8897). For example:

  ```json
  {
    "pnpm": {
      "onlyBuiltDependencies": ["fsevents"]
    }
  }
  ```

- `pnpm link` behavior updated:

  The `pnpm link` command now adds overrides to the root `package.json`.

  - In a workspace: The override is added to the root of the workspace, linking the dependency to all projects in the workspace.
  - Global linking: To link a package globally, run `pnpm link` from the package’s directory. Previously, you needed to use `pnpm link -g`.
    Related PR: [#&#8203;8653](https://redirect.github.com/pnpm/pnpm/pull/8653)

- Secure hashing with SHA256:

  Various hashing algorithms have been updated to SHA256 for enhanced security and consistency:

  - Long paths inside `node_modules/.pnpm` are now hashed with SHA256.
  - Long peer dependency hashes in the lockfile now use SHA256 instead of MD5. (This affects very few users since these are only used for long keys.)
  - The hash stored in the `packageExtensionsChecksum` field of `pnpm-lock.yaml` is now SHA256.
  - The side effects cache keys now use SHA256.
  - The pnpmfile checksum in the lockfile now uses SHA256 ([#&#8203;8530](https://redirect.github.com/pnpm/pnpm/pull/8530)).

- Configuration updates:

  - `manage-package-manager-versions`: enabled by default. pnpm now manages its own version based on the `packageManager` field in `package.json` by default.

  - `public-hoist-pattern`: nothing is hoisted by default. Packages containing `eslint` or `prettier` in their name are no longer hoisted to the root of `node_modules`. Related Issue: [#&#8203;8378](https://redirect.github.com/pnpm/pnpm/issues/8378)

  - Upgraded `@yarnpkg/extensions` to v2.0.3. This may alter your lockfile.

  - `virtual-store-dir-max-length`: the default value on Windows has been reduced to 60 characters.

  - Reduced environment variables for scripts:
    During script execution, fewer `npm_package_*` environment variables are set. Only `name`, `version`, `bin`, `engines`, and `config` remain.
    Related Issue: [#&#8203;8552](https://redirect.github.com/pnpm/pnpm/issues/8552)

  - All dependencies are now installed even if `NODE_ENV=production`. Related Issue: [#&#8203;8827](https://redirect.github.com/pnpm/pnpm/issues/8827)

- Changes to the global store:

  - Store version bumped to v10.

  - Some registries allow identical content to be published under different package names or versions. To accommodate this, index files in the store are now stored using both the content hash and package identifier.

    This approach ensures that we can:

    1. Validate that the integrity in the lockfile corresponds to the correct package, which might not be the case after a poorly resolved Git conflict.
    2. Allow the same content to be referenced by different packages or different versions of the same package.
       Related PR: [#&#8203;8510](https://redirect.github.com/pnpm/pnpm/pull/8510)
       Related Issue: [#&#8203;8204](https://redirect.github.com/pnpm/pnpm/issues/8204)

  - More efficient side effects indexing. The structure of index files in the store has changed. Side effects are now tracked more efficiently by listing only file differences rather than all files.
    Related PR: [#&#8203;8636](https://redirect.github.com/pnpm/pnpm/pull/8636)

  - A new `index` directory stores package content mappings. Previously, these files were in `files`.

- Other breaking changes:
  - The `#` character is now escaped in directory names within `node_modules/.pnpm`.
    Related PR: [#&#8203;8557](https://redirect.github.com/pnpm/pnpm/pull/8557)
  - Running `pnpm add --global pnpm` or `pnpm add --global @&#8203;pnpm/exe` now fails with an error message, directing you to use `pnpm self-update` instead.
    Related PR: [#&#8203;8728](https://redirect.github.com/pnpm/pnpm/pull/8728)
  - Dependencies added via a URL now record the final resolved URL in the lockfile, ensuring that any redirects are fully captured.
    Related Issue: [#&#8203;8833](https://redirect.github.com/pnpm/pnpm/issues/8833)
  - The `pnpm deploy` command now only works in workspaces that have `inject-workspace-packages=true`. This limitation is introduced to allow us to create a proper lockfile for the deployed project using the workspace lockfile.
  - Removed conversion from lockfile v6 to v9. If you need v6-to-v9 conversion, use pnpm CLI v9.
  - `pnpm test` now passes all parameters after the `test` keyword directly to the underlying script. This matches the behavior of `pnpm run test`. Previously you needed to use the `--` prefix.
    Related PR: [#&#8203;8619](https://redirect.github.com/pnpm/pnpm/pull/8619)

- `node-gyp` updated to version 11.

- `pnpm deploy` now tries creating a dedicated lockfile from a shared lockfile for deployment. It will fallback to deployment without a lockfile if there is no shared lockfile or `force-legacy-deploy` is set to `true`.

##### Minor Changes

- Added support for a new type of dependencies called "configurational dependencies". These dependencies are installed before all the other types of dependencies (before "dependencies", "devDependencies", "optionalDependencies").

  Configurational dependencies cannot have dependencies of their own or lifecycle scripts. They should be added using exact version and the integrity checksum. Example:

  ```json
  {
    "pnpm": {
      "configDependencies": {
        "my-configs": "1.0.0+sha512-30iZtAPgz+LTIYoeivqYo853f02jBYSd5uGnGpkFV0M3xOt9aN73erkgYAmZU43x4VfqcnLxW9Kpg3R5LC4YYw=="
      }
    }
  }
  ```

  Related RFC: [#&#8203;8](https://redirect.github.com/pnpm/rfcs/pull/8).
  Related PR: [#&#8203;8915](https://redirect.github.com/pnpm/pnpm/pull/8915).

- New settings:

  - New `verify-deps-before-run` setting. This setting controls how `pnpm` checks `node_modules` before running scripts:

    - `install`: Automatically run `pnpm install` if `node_modules` is outdated.
    - `warn`: Print a warning if `node_modules` is outdated.
    - `prompt`: Prompt the user to confirm running `pnpm install` if `node_modules` is outdated.
    - `error`: Throw an error if `node_modules` is outdated.
    - `false`: Disable dependency checks.
      Related Issue: [#&#8203;8585](https://redirect.github.com/pnpm/pnpm/issues/8585)

  - New `inject-workspace-packages` setting enables hard-linking all local workspace dependencies instead of symlinking them. Previously, this could be achieved using [`dependenciesMeta[].injected`](https://pnpm.io/package_json#dependenciesmetainjected), which remains supported.
    Related PR: [#&#8203;8836](https://redirect.github.com/pnpm/pnpm/pull/8836)

- Faster repeat installs:

  On repeated installs, `pnpm` performs a quick check to ensure `node_modules` is up to date.
  Related PR: [#&#8203;8838](https://redirect.github.com/pnpm/pnpm/pull/8838)

- `pnpm add` integrates with default workspace catalog:

  When adding a dependency, `pnpm add` checks the default workspace catalog. If the dependency and version requirement match the catalog, `pnpm add` uses the `catalog:` protocol. Without a specified version, it matches the catalog’s version. If it doesn’t match, it falls back to standard behavior.
  Related Issue: [#&#8203;8640](https://redirect.github.com/pnpm/pnpm/issues/8640)

- `pnpm dlx` now resolves packages to their exact versions and uses these exact versions for cache keys. This ensures `pnpm dlx` always installs the latest requested packages.
  Related PR: [#&#8203;8811](https://redirect.github.com/pnpm/pnpm/pull/8811)

- No `node_modules` validation on certain commands. Commands that should not modify `node_modules` (e.g., `pnpm install --lockfile-only`) no longer validate or purge `node_modules`.
  Related PR: [#&#8203;8657](https://redirect.github.com/pnpm/pnpm/pull/8657)

### [`v9.15.9`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.9): pnpm 9.15.9

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.8...v9.15.9)

#### Patch Changes

- Fix running pnpm CLI from pnpm CLI on Windows when the CLI is bundled to an executable [#&#8203;8971](https://redirect.github.com/pnpm/pnpm/issues/8971).

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://syntax.fm/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/syntaxfm.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/syntaxfm_light.svg" />
            <img src="https://pnpm.io/img/users/syntaxfm.svg" width="90" alt="Syntax" />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg?0" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg?0" />
            <img src="https://pnpm.io/img/users/nx.svg" width="70" alt="Nx" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://stackblitz.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/stackblitz.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/stackblitz_light.svg" />
            <img src="https://pnpm.io/img/users/stackblitz.svg" width="190" alt="Stackblitz" />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.8`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.8): pnpm 9.15.8

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.7...v9.15.8)

#### Patch Changes

- `pnpm self-update` should always update the version in the `packageManager` field of `package.json`.
- The pnpm CLI process should not stay hanging, when `--silent` reporting is used.
- When `--loglevel` is set to `error`, don't show installation summary, execution time, and big tarball download progress.
- Don't show info output when `--loglevel=error` is used.

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://syntax.fm/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/syntaxfm.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/syntaxfm_light.svg" />
            <img src="https://pnpm.io/img/users/syntaxfm.svg" width="90" alt="Syntax" />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg?0" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg?0" />
            <img src="https://pnpm.io/img/users/nx.svg" width="70" alt="Nx" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://stackblitz.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/stackblitz.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/stackblitz_light.svg" />
            <img src="https://pnpm.io/img/users/stackblitz.svg" width="190" alt="Stackblitz" />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.7`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.7): pnpm 9.15.7

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.6...v9.15.7)

#### Patch Changes

- `pnpm self-update` should not leave a directory with a broken pnpm installation if the installation fails.
- Allow scope registry CLI option without `--config.` prefix such as `--@&#8203;scope:registry=https://scope.example.com/npm` [#&#8203;9089](https://redirect.github.com/pnpm/pnpm/pull/9089).
- `pnpm self-update` should not read the pnpm settings from the `package.json` file in the current working directory.
- `pnpm update -i` should list only packages that have newer versions [#&#8203;9206](https://redirect.github.com/pnpm/pnpm/issues/9206).
- Fix a bug causing entries in the `catalogs` section of the `pnpm-lock.yaml` file to be removed when `dedupe-peer-dependents=false` on a filtered install. [#&#8203;9112](https://redirect.github.com/pnpm/pnpm/issues/9112)

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://syntax.fm/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/syntaxfm.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/syntaxfm_light.svg" />
            <img src="https://pnpm.io/img/users/syntaxfm.svg" width="90" alt="Syntax" />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg" />
            <img src="https://pnpm.io/img/users/nx.svg" width="120" alt="Nx" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://stackblitz.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/stackblitz.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/stackblitz_light.svg" />
            <img src="https://pnpm.io/img/users/stackblitz.svg" width="190" alt="Stackblitz" />
          </picture>
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.6`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.6): pnpm 9.15.6

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.5...v9.15.6)

#### Patch Changes

- Fix instruction for updating pnpm with corepack [#&#8203;9101](https://redirect.github.com/pnpm/pnpm/pull/9101).
- Print pnpm's version after the execution time at the end of the console output.
- The pnpm version specified by `packageManager` cannot start with `v`.
- Fix a bug causing catalog snapshots to be removed from the `pnpm-lock.yaml` file when using `--fix-lockfile` and `--filter`. [#&#8203;8639](https://redirect.github.com/pnpm/pnpm/issues/8639)
- Fix a bug causing catalog protocol dependencies to not re-resolve on a filtered install [#&#8203;8638](https://redirect.github.com/pnpm/pnpm/issues/8638).

### [`v9.15.5`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.5): pnpm 9.15.5

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.4...v9.15.5)

#### Patch Changes

- Verify that the package name is valid when executing the publish command.
- When running `pnpm install`, the `preprepare` and `postprepare` scripts of the project should be executed [#&#8203;8989](https://redirect.github.com/pnpm/pnpm/pull/8989).
- Quote args for scripts with shell-quote to support new lines (on POSIX only) [#&#8203;8980](https://redirect.github.com/pnpm/pnpm/issues/8980).
- Proxy settings should be respected, when resolving Git-hosted dependencies [#&#8203;6530](https://redirect.github.com/pnpm/pnpm/issues/6530).
- Replace `strip-ansi` with the built-in `util.stripVTControlCharacters` [#&#8203;9009](https://redirect.github.com/pnpm/pnpm/pull/9009).

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://figma.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/figma.svg" width="80" alt="Figma"></a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://prisma.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/prisma.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/prisma_light.svg" />
            <img src="https://pnpm.io/img/users/prisma.svg" width="180" alt="Prisma" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg" />
            <img src="https://pnpm.io/img/users/nx.svg" width="120" alt="Nx" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://canva.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/canva.svg" width="120" alt="Canva" />
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.4`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.4): pnpm 9.15.4

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.3...v9.15.4)

#### Patch Changes

- Ensure that recursive `pnpm update --latest <pkg>` updates only the specified package, with `dedupe-peer-dependents=true`.

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://figma.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/figma.svg" width="80" alt="Figma"></a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://prisma.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/prisma.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/prisma_light.svg" />
            <img src="https://pnpm.io/img/users/prisma.svg" width="180" alt="Prisma" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg" />
            <img src="https://pnpm.io/img/users/nx.svg" width="120" alt="Nx" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://canva.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/canva.svg" width="120" alt="Canva" />
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.3`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.3): pnpm 9.15.3

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.2...v9.15.3)

#### Patch Changes

- Fixed the Regex used to find the package manifest during packing [#&#8203;8938](https://redirect.github.com/pnpm/pnpm/pull/8938).
- `pnpm update --filter <pattern> --latest <pkg>` should only change the specified package for the specified workspace, when `dedupe-peer-dependents` is set to `true` [#&#8203;8877](https://redirect.github.com/pnpm/pnpm/issues/8877).
- Exclude `.DS_Store` file at `patch-commit` [#&#8203;8922](https://redirect.github.com/pnpm/pnpm/issues/8922).
- Fix a bug in which `pnpm patch` is unable to bring back old patch without specifying `@version` suffix [#&#8203;8919](https://redirect.github.com/pnpm/pnpm/issues/8919).

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://figma.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/figma.svg" width="80" alt="Figma"></a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://prisma.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/prisma.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/prisma_light.svg" />
            <img src="https://pnpm.io/img/users/prisma.svg" width="180" alt="Prisma" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg" />
            <img src="https://pnpm.io/img/users/nx.svg" width="120" alt="Nx" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://canva.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/canva.svg" width="120" alt="Canva" />
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.2`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.2): pnpm 9.15.2

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.1...v9.15.2)

#### Patch Changes

- Fixed `publish`/`pack` error with workspace dependencies with relative paths [#&#8203;8904](https://redirect.github.com/pnpm/pnpm/pull/8904). It was broken in `v9.4.0` ([398472c](https://redirect.github.com/pnpm/pnpm/commit/398472c)).
- Use double quotes in the command suggestion by `pnpm patch` on Windows [#&#8203;7546](https://redirect.github.com/pnpm/pnpm/issues/7546).
- Do not fall back to SSH, when resolving a git-hosted package if `git ls-remote` works via HTTPS [#&#8203;8906](https://redirect.github.com/pnpm/pnpm/pull/8906).
- Improve how packages with blocked lifecycle scripts are reported during installation. Always print the list of ignored scripts at the end of the output. Include a hint about how to allow the execution of those packages.

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://figma.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/figma.svg" width="80" alt="Figma"></a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://prisma.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/prisma.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/prisma_light.svg" />
            <img src="https://pnpm.io/img/users/prisma.svg" width="180" alt="Prisma" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://nx.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/nx.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/nx_light.svg" />
            <img src="https://pnpm.io/img/users/nx.svg" width="120" alt="Nx" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://coderabbit.ai/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/coderabbit.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/coderabbit_light.svg" />
            <img src="https://pnpm.io/img/users/coderabbit.svg" width="220" alt="CodeRabbit" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://route4me.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/route4me.svg" width="220" alt="Route4Me" />
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://workleap.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/workleap.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/workleap_light.svg" />
            <img src="https://pnpm.io/img/users/workleap.svg" width="190" alt="Workleap" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://canva.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <img src="https://pnpm.io/img/users/canva.svg" width="120" alt="Canva" />
        </a>
      </td>
    </tr>
  </tbody>
</table>

### [`v9.15.1`](https://redirect.github.com/pnpm/pnpm/releases/tag/v9.15.1): pnpm 9.15.1

[Compare Source](https://redirect.github.com/pnpm/pnpm/compare/v9.15.0...v9.15.1)

#### Patch Changes

- `pnpm remove` should not link dependencies from the workspace, when `link-workspace-packages` is set to `false` [#&#8203;7674](https://redirect.github.com/pnpm/pnpm/issues/7674).
- Installation with hoisted `node_modules` should not fail, when a dependency has itself in its own peer dependencies [#&#8203;8854](https://redirect.github.com/pnpm/pnpm/issues/8854).

#### Platinum Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://bit.dev/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/bit.svg" width="80" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://sanity.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/sanity.svg" width="180" alt="Bit"></a>
      </td>
      <td align="center" valign="middle">
        <a href="https://figma.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank"><img src="https://pnpm.io/img/users/figma.svg" width="80" alt="Figma"></a>
      </td>
    </tr>
  </tbody>
</table>

#### Gold Sponsors

<table>
  <tbody>
    <tr>
      <td align="center" valign="middle">
        <a href="https://discord.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/discord.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/discord_light.svg" />
            <img src="https://pnpm.io/img/users/discord.svg" width="220" alt="Discord" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://prisma.io/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/prisma.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/prisma_light.svg" />
            <img src="https://pnpm.io/img/users/prisma.svg" width="180" alt="Prisma" />
          </picture>
        </a>
      </td>
    </tr>
    <tr>
      <td align="center" valign="middle">
        <a href="https://uscreen.de/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/uscreen.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/uscreen_light.svg" />
            <img src="https://pnpm.io/img/users/uscreen.svg" width="180" alt="u|screen" />
          </picture>
        </a>
      </td>
      <td align="center" valign="middle">
        <a href="https://www.jetbrains.com/?utm_source=pnpm&utm_medium=release_notes" target="_blank">
          <picture>
            <source media="(prefers-color-scheme: light)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <source media="(prefers-color-scheme: dark)" srcset="https://pnpm.io/img/users/jetbrains.svg" />
            <img src="https://pnpm.io/img/users/jetbrains.svg" width="180" alt="JetBrains" />
          <

</details>

---

### Configuration

📅 **Schedule**: Branch creation - "" (UTC), Automerge - At any time (no schedule defined).

🚦 **Automerge**: Disabled by config. Please merge this manually once you are satisfied.

♻ **Rebasing**: Whenever PR becomes conflicted, or you tick the rebase/retry checkbox.

🔕 **Ignore**: Close this PR and you won't be reminded about these updates again.

---

 - [ ] <!-- rebase-check -->If you want to rebase/retry this PR, check this box

---

This PR was generated by [Mend Renovate](https://mend.io/renovate/). View the [repository job log](https://developer.mend.io/github/redwoodjs/sdk).
<!--renovate-debug:eyJjcmVhdGVkSW5WZXIiOiI0MS45Ny4xMCIsInVwZGF0ZWRJblZlciI6IjQxLjk3LjEwIiwidGFyZ2V0QnJhbmNoIjoibWFpbiIsImxhYmVscyI6W119-->


---

### PR #755 - infra: CI improvements
https://github.com/redwoodjs/sdk/pull/755
Author: @justinvdm  Merged: 2025-09-20T14:12:28Z

* We now allow retries for each cell in the (OS, package manager) test matrix for smoke tests and e2e tests
* We've now added macos to test matrix for smoke tests and e2e tests

---

### PR #756 - chore: Remove deprecated `requestInfo.headers` API
https://github.com/redwoodjs/sdk/pull/756
Author: @justinvdm  Merged: 2025-09-25T10:10:29Z

This change removes two APIs to simplify the developer experience:
1.  The deprecated `headers` property from the `RequestInfo` interface.
2.  The undocumented `resolveSSRValue` helper function.

### BREAKING CHANGE: `requestInfo.headers` removal

The `headers` property on the `RequestInfo` object has been removed. All response header modifications should now be done through the `response.headers` object.

#### Migration Guide

To update your code, replace any usage of `requestInfo.headers` with `requestInfo.response.headers`.

**Before:**

```typescript
const myMiddleware = (requestInfo) => {
  requestInfo.headers.set('X-Custom-Header', 'my-value');
};
```

**After:**

```typescript
const myMiddleware = (requestInfo) => {
  requestInfo.response.headers.set('X-Custom-Header', 'my-value');
};
```

### BREAKING CHANGE: `resolveSSRValue` removal

The `resolveSSRValue` helper function has been removed. SSR-only functions can now be imported and called directly within Server Actions without this wrapper.

#### Migration Guide

Remove the `resolveSSRValue` wrapper and call the SSR function directly.

**Before:**

```typescript
import { env } from "cloudflare:workers";
import { ssrSendWelcomeEmail } from "@/app/email/ssrSendWelcomeEmail";
import { resolveSSRValue } from "rwsdk/worker";

export async function sendWelcomeEmail(formData: FormData) {
  const doSendWelcomeEmail = await resolveSSRValue(ssrSendWelcomeEmail);

  const email = formData.get("email") as string;

  if (!email) {
    console.error("❌ Email is required");
    return { error: "Email is required", success: false };
  }

  const { data, error } = await doSendWelcomeEmail(env.RESEND_API, email);

  if (error) {
    console.error("❌ Error sending email", error);
    return { error: error.message, success: false };
  }

  console.log("📥 Email sent successfully", data);
  return { success: true, error: null };
}
```

**After:**

```typescript
import { env } from "cloudflare:workers";
import { ssrSendWelcomeEmail } from "@/app/email/ssrSendWelcomeEmail";

export async function sendWelcomeEmail(formData: FormData) {
  const email = formData.get("email") as string;

  if (!email) {
    console.error("❌ Email is required");
    return { error: "Email is required", success: false };
  }

  const { data, error } = await ssrSendWelcomeEmail(env.RESEND_API, email);

  if (error) {
    console.error("❌ Error sending email", error);
    return { error: error.message, success: false };
  }

  console.log("📥 Email sent successfully", data);
  return { success: true, error: null };
}
```


---

### PR #757 - docs: Document API Stability and Compatibility
https://github.com/redwoodjs/sdk/pull/757
Author: @justinvdm  Merged: 2025-09-24T13:30:20Z

To prepare for a 1.0 beta release, we need to communicate which parts of the SDK are stable and which are experimental. This update establishes a system for marking experimental APIs directly within the documentation. We've implemented a convention where experimental pages or specific functions are marked with an 'Experimental' badge. This is handled by adding an `experimental: true` flag to the frontmatter of relevant documentation pages, which then conditionally renders the badge in the page title. This provides clear, inline guidance to users about the stability of different features.

---

### PR #758 - tests: ShadCN playground
https://github.com/redwoodjs/sdk/pull/758
Author: @justinvdm  Merged: 2025-09-23T09:25:47Z

This adds a comprehensive playground example for shadcn/ui to demonstrate its integration with RedwoodSDK.

The goal is to provide a complete reference implementation that showcases all available shadcn/ui components. This serves as both a testing ground for the framework's compatibility and a detailed example for users looking to integrate shadcn/ui.

Fixes #683

---

### PR #759 - fix: Scope middleware to prefixes
https://github.com/redwoodjs/sdk/pull/759
Author: @justinvdm  Merged: 2025-09-22T01:36:49Z

### Problem

Middleware defined within a `prefix` block was not scoped to that prefix. It was executed for all routes, regardless of whether the request path matched the prefix. This meant that middleware intended for a specific section of the application (e.g., `/admin`) would run on every request.

### Solution

The `prefix` utility has been updated to wrap middleware functions. This wrapper checks if the request's pathname starts with the specified prefix. If it does, the middleware is executed. If the path does not match, the middleware is skipped. This change correctly scopes middleware to its intended route prefix, resolving the bug.

---

### PR #760 - fix(e2e): ensure test workers are deleted after tests
https://github.com/redwoodjs/sdk/pull/760
Author: @justinvdm  Merged: 2025-09-22T01:40:06Z

### Problem

End-to-end tests that deploy Cloudflare workers were not cleaning up (deleting) those workers after the tests completed. This resulted in an accumulation of test workers in the Cloudflare account.

The cleanup mechanism includes a safety check to ensure it only deletes workers related to the specific test run. It does this by comparing a `resourceUniqueKey` with the worker's name.

The problem was that the `resourceUniqueKey` used for the cleanup check was generated randomly and separately from the unique ID embedded in the deployed worker's name. Because these two identifiers never matched, the safety check would fail, and the worker deletion would be skipped.

### Solution

The fix is to ensure the `resourceUniqueKey` is derived from the same source as the unique ID in the worker's name. The worker's name is based on the temporary directory created for the test, which has a name format like `{projectName}-e2e-test-{randomId}`.

The solution modifies the `createDeployment()` function in the E2E test harness. Instead of generating a new random `resourceUniqueKey`, it now extracts the `{randomId}` from the test's temporary directory path. This ensures that the key used for the cleanup check matches the one in the worker's name => allows the worker to be correctly identified and deleted after the test.

---

### PR #761 - fix(e2e): Disable inspector port in tests to prevent collisions
https://github.com/redwoodjs/sdk/pull/761
Author: @justinvdm  Merged: 2025-09-22T02:14:27Z

This change addresses an intermittent failure in the end-to-end tests caused by inspector port collisions. When multiple dev server tests run in parallel, they would sometimes attempt to bind to the same default inspector port, leading to a race condition and test failures.

The fix is to disable the inspector port within the Vite configuration for all playground applications when the CI environment variable is set. This prevents the port conflict during automated testing while keeping the inspector available for local development.

---

### PR #762 - fix: Account for `use strict` when finding client/server directives
https://github.com/redwoodjs/sdk/pull/762
Author: @justinvdm  Merged: 2025-09-22T13:07:30Z

We weren't account for `"use strict"` being on top of the file when checking for `"use client"`/`"use server"` directives.

---

### PR #764 - chore: CI Worker cleanup
https://github.com/redwoodjs/sdk/pull/764
Author: @justinvdm  Merged: 2025-09-22T09:43:40Z

The end-to-end tests for deployments were not consistently cleaning up the Cloudflare workers created during the test runs. This was caused by authentication issues with `wrangler` in the CI environment.

This change modifies the cleanup logic to explicitly pass the necessary Cloudflare credentials (`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`) to the `wrangler delete` command. This ensures that the cleanup process can authenticate correctly and remove the test workers after the tests complete.

---

### PR #765 - chore: Fix E2E flake
https://github.com/redwoodjs/sdk/pull/765
Author: @justinvdm  Merged: 2025-09-22T11:10:42Z

- **Automatic Retries**: Added a retry mechanism to handle transient network errors.
- **Reliable Worker Cleanup**: Replaced `wrangler delete` with a direct Cloudflare API call for worker cleanup.
- **Smarter Database Cleanup**: The D1 cleanup now checks `wrangler.jsonc` before attempting deletion.
- **Deployment Polling**: Added polling to wait for deployments to be live before running tests.
- **Increased Test Timeout**: Increased the polling timeout to 2 minutes.

---

### PR #766 - infra: Better CI structure
https://github.com/redwoodjs/sdk/pull/766
Author: @justinvdm  Merged: 2025-09-22T12:57:51Z

### Problem

Running the full test matrix (all OS and package manager combinations for both smoke and E2E tests) on every pull request resulted in a slow and often flaky CI feedback loop.

### Approach

This change refactors the CI strategy to run a smaller suite of tests on pull requests and the full suite on the `main` branch.

1.  **Differentiated CI Pipeline**:
    *   **On Pull Requests**: A minimal subset of smoke and E2E tests runs (Ubuntu with pnpm).
    *   **On `main`**: The full test matrix runs on every push.

2.  **Release Gate**:
    *   The `release` workflow is now gated. It begins with a job that uses the GitHub CLI to query all CI runs associated with the latest commit on `main`.
    *   If any check has failed or is in progress, the release is blocked.

3.  **Manual Test Execution**:
    *   The `smoke-test-starters` and `playground-e2e-tests` workflows now have `workflow_dispatch` inputs. These can be used to manually run tests for specific configurations, since the full matrix no longer runs on pull requests.

4.  **CI Dashboard**:
    *   The `README.md` now includes a "CI Status" section with a matrix of status badges for the test jobs that run on the `main` branch.


---

### PR #767 - infra: Add retry mechanism for Chrome installation.
https://github.com/redwoodjs/sdk/pull/767
Author: @justinvdm  Merged: 2025-09-22T13:30:11Z

Our CI tests sometimes flake on failed Chrome downloads. This PR adds 10 retries to this.

---

### PR #769 - tests: Add RSC kitchen sink playground example
https://github.com/redwoodjs/sdk/pull/769
Author: @justinvdm  Merged: 2025-09-23T09:35:14Z

This change introduces a new e2e/playground example, `rsc-kitchen-sink`, to demonstrate the framework's React Server Components (RSC) capabilities and cover it with e2e tests. The example includes a server component that renders a client component, which in turn executes two types of server actions: a form action and an `onClick` action. 

We already have our smoke tests covering this, but having it as a playground example helps for debugging purposes when working on the sdk.

---

### PR #770 - infra: Clean up node_modules and lockfiles before installing dependencies.
https://github.com/redwoodjs/sdk/pull/770
Author: @justinvdm  Merged: 2025-09-22T16:30:31Z

Ensure that after copying e2e test to temp dir to run in isolation, that there aren't files left around that would bias its run for each package manager.

---

### PR #772 - infra: Fix CI runs for yarn
https://github.com/redwoodjs/sdk/pull/772
Author: @justinvdm  Merged: 2025-09-23T06:40:10Z

* **Moved package manager setup to test environment** - Now sets up each package manager in isolated temporary directory rather than only in CI. This allows us to reproduce package manager specific issues locally.
* **Fixed Yarn Berry lockfile errors** - Added `enableImmutableInstalls: false` to test projects
* **Added test documentation** - Documented how to run specific tests with different package managers
* For now, removed yarn classic from build matrix to unblock releases while we get yarn classic working with e2e and smoke tests (we're facing a hurdle getting yarn classic to run esbuild's compile step)
* For now, using node modules linker for yarn berry until #771 is solved

---

### PR #774 - feat: Support non-component imports from "use client" modules
https://github.com/redwoodjs/sdk/pull/774
Author: @justinvdm  Merged: 2025-09-23T16:56:31Z

### Problem

Previously, in our hybrid RSC/SSR rendering model, modules marked with `"use client"` presented a challenge for non-component exports.

The `worker` environment, responsible for both RSC and SSR, would transform a `"use client"` module into a set of client reference proxies. This is correct for the RSC pass, but it created a problem for any other server-side code. If any logic in the `worker` needed to import a non-component export (e.g., a utility function, a constant, or a library-specific object) from that same client module, it couldn't. The actual implementation was completely replaced by the proxy, making the export inaccessible to any server-side logic.

This limited the utility of client modules and was a significant blocker for complex component libraries like Chakra UI, which co-locate components and utility objects in the same client modules.

### Solution

This change introduces a mechanism to bridge this gap, allowing non-component exports from `"use client"` modules to be correctly resolved and used within the `worker` environment during the SSR pass.

The solution has two main parts:

1.  **Build-Time Transformation:** The `transformClientComponents` plugin has been updated. It no longer generates different code for dev and production. It now consistently generates code that imports the `ssrLoadModule` helper from the `rwsdk/__ssr_bridge` entry point and uses it to asynchronously load the SSR-processed version of the client module.

2.  **Runtime Conditional Logic:** The `registerClientReference` function in the worker runtime has been updated. It now accepts the imported `SSRModule` and inspects each export.
    *   If an export is identified as a **React component** (using `react-is`), it returns a standard, serializable client reference placeholder, which is what the RSC renderer expects.
    *   If an export is a **non-component**, it returns the *actual export* from the `SSRModule` directly.

This allows any server-side code to import `MyUtil` from a client module and use it on the server, while still treating `<MyComponent>` from that same module as a client reference for the RSC phase. This unified approach respects the single-entry-point architecture of our production builds while still leveraging the existing `virtual:use-client-lookup.js` map for lazy execution.

The solution was validated with a new `import-from-use-client` playground that tests (with end to end tests) app-to-app, app-to-package, and package-to-package imports. It was also confirmed to resolve the integration issues with Chakra UI.

---

### PR #775 - fix: Improve monorepo support for dependency scanning
https://github.com/redwoodjs/sdk/pull/775
Author: @justinvdm  Merged: 2025-09-24T03:41:26Z

## Problem

In certain monorepo configurations (e.g., using Yarn Berry or pnpm workspaces), Vite's `optimizeDeps` scanner and the framework's internal directive scanner could fail to resolve `rwsdk` modules. This was caused by two distinct issues:

1.  **Optimizer Resolution Failure:** When a third-party dependency (like Radix UI) was hoisted to the monorepo root, Vite's `optimizeDeps` scanner would try to resolve `rwsdk` imports from the root. It would fail because it had no awareness of the `rwsdk` package located in a nested workspace's `node_modules` directory.
2.  **Symlink Path Mismatch:** Even when the optimizer was fixed, the framework's "use client" module lookup would fail during SSR. This was because our directive scanner operated on the original, symlinked path of a module, while Vite's SSR process used the real, canonical path, leading to a key mismatch in our lookup maps.

## Solution

This was addressed with a two-part, framework-level fix that requires no user configuration:

1.  **Generalized Dependency Resolver:** The existing `reactConditionsResolverPlugin` has been generalized into a `knownDependenciesResolverPlugin`. This plugin, which uses `enhanced-resolve`, now handles `rwsdk` imports in addition to React's. It correctly resolves these dependencies from the user's project root, making Vite's optimizer aware of their location.
2.  **Canonical Path Resolution:** The `runDirectivesScan` plugin was updated to use `fs.realpath` on all discovered module paths. This ensures that the framework's internal maps are keyed by the canonical file path, matching Vite's behavior and preventing lookup failures during SSR.

A new playground, `monorepo-top-level-deps`, was created to reliably reproduce this specific hoisting scenario and validate the fix.

---

### PR #777 - feat: Add manual client module overrides + Chakra UI playground`
https://github.com/redwoodjs/sdk/pull/777
Author: @justinvdm  Merged: 2025-09-24T07:08:40Z

### Context

The primary goal was to create a playground to test and demonstrate the integration of the Chakra UI component library with our React Server Components framework, including comprehensive end-to-end tests.

### Hurdles

Several issues were encountered during the implementation.

**1. `"use strict"` Directive Interference**

Solved in #762 (see PR description for context)

**2. Non-Component Exports from Client Modules**

Solved in #774 (see PR description for context)

**3. Server-Side Execution of Client APIs in Chakra UI**

After resolving the framework-level issues, a final blocker emerged. Certain files associated with Chakra UI's `<Code>` component use `createContext`, a React API that is not available in the server environment. These files do not include a `"use client"` directive, which leads to a runtime error.

The files are:
-   [`code-block-context.ts`](https://github.com/chakra-ui/chakra-ui/blob/79971c0d1ccac7921e5e5c65faa93e3fe8456bca/packages/react/src/components/code-block/code-block-adapter-context.ts)
-   [`code-block-adapter-context.ts`](https://github.com/chakra-ui/chakra-ui/blob/79971c0d1ccac7921e5e5c65faa93e3fe8456bca/packages/react/src/components/code-block/code-block-adapter-provider.tsx)

Looking at modules performing the same function for other Chakra UI components, they use "use client" directives. That, combined with the `createContext` call, leads me to believe this was unintentional and should in fact include a `"use client"` directive (I will ask Chakra to get clarity here).

For now, to address this and provide a general-purpose solution for similar cases in other libraries, this PR introduces a `forceClientPaths` option to the RedwoodSDK Vite plugin. This allows developers to manually designate modules as client-side.

---

### PR #778 - Investigate CI failures
https://github.com/redwoodjs/sdk/pull/778
Author: @justinvdm  Merged: 2025-09-25T00:16:17Z

*   **Concurrent Test Execution**: The test harness now provisions dev and deployment environments concurrently within the `beforeAll` hook. The `testDev` and `testDeploy` helpers were updated to use `test.concurrent`.
*   **Shared Browser Instance**: A `globalSetup` file was added to the Vitest configuration. It launches a single browser instance and writes its WebSocket endpoint to a temporary file. Tests now connect to this shared instance.
*   **Server Readiness Polling**: The `runDevServer` and `createDeployment` functions now poll their respective server URLs after the process is spawned. The functions only return after a successful `fetch` response is received.
*   **Refactored Polling Utility**: The `poll` function was moved to its own module and refactored to accept an options object. A `minTries` parameter was added, and all call sites were updated to use the new signature.

---

### PR #779 - tests: Fix E2E regression after concurrency improvements
https://github.com/redwoodjs/sdk/pull/779
Author: @justinvdm  Merged: 2025-09-25T03:40:32Z

## Problem 1: Closing the browser too early

After a recent change (be1d1d22283bd67ebeeb644e3c9f1dc33b4310c4), we were prematurely closing the browser at the end of each test suite even though we use a shared browser across the suites.

To solve this, we disconnect from the browser at end of each test suite rather than trying to close the browser.

## Problem 2: Shared test harness state

The dev server and deployment tests are run in separate project dirs / installs, yet they were sharing test harness state (e.g. for cleanup).

---

### PR #780 - feat: Add MDX support to directive scanner
https://github.com/redwoodjs/sdk/pull/780
Author: @justinvdm  Merged: 2025-09-25T09:11:53Z

### Problem

The directive scanner, which uses `esbuild` to traverse the dependency graph, could not process `.mdx` files. This caused the build to fail in projects that used MDX, as `esbuild` does not have a native loader for the format.

### Solution

After exploring several alternatives, the most robust solution was to make the scanner self-sufficient.

- The `@mdx-js/mdx` package is now a direct dependency of the SDK.
- The scanner's `onLoad` hook in `runDirectivesScan.mts` now detects `.mdx` files and uses the imported `compile` function to transform their content into TSX.
- This transformed code is then passed to `esbuild`, which can process it natively.

---

### PR #781 - tests: BaseUI playground
https://github.com/redwoodjs/sdk/pull/781
Author: @justinvdm  Merged: 2025-09-25T09:16:53Z

This PR introduces a new playground example for Base UI to demonstrate its integration with RedwoodSDK.

The primary goals of this example are to:
- Showcase support for a popular headless component library.
- Serve as a reference for users on structuring an application with both server-rendered content and interactive client components.
- Expand end-to-end test coverage to ensure compatibility with Base UI's styling and hydration patterns, particularly with CSS Modules.

---

### PR #783 - fix(ssr): Support server-callable components from client modules
https://github.com/redwoodjs/sdk/pull/783
Author: @justinvdm  Merged: 2025-09-25T09:18:56Z

### Problem

Recent work ([#774](https://github.com/redwoodjs/sdk/pull/774)) introduced support for importing non-component exports from `"use client"` modules into the server environment. Integrating an example that relies on this for `@react-email/render` highlighted two edge cases.

First, a function exported from a `"use client"` module that also returns JSX was being treated exclusively as a client reference placeholder. This made it impossible to *call* the function from a Server Action, as the actual implementation was inaccessible in the `worker` environment.

Second, when such a module from the application's source was loaded into the `worker` via the SSR Bridge, it would trigger a Vite dependency re-optimization. The `ssr` environment's optimizer was not aware of the application's internal client modules upfront, causing a worker reload that wiped all module-level state.

### Solution

This change addresses both issues.

The `registerClientReference` runtime function is updated. When it encounters an export that is both a valid React component and a function, it now creates a proxy that is a callable function. This proxy wraps the original SSR implementation, allowing it to be executed from server code, while still having the necessary `$$` properties for the RSC renderer to treat it as a client reference.

The `directiveModulesDevPlugin` is updated to include the application's client barrel file in the `optimizeDeps.entries` for the `ssr` environment. This ensures Vite's dependency scanner is aware of all app-level client modules at startup, preventing disruptive re-optimizations during development.

---

### PR #784 - fix: Update rwsdk package dependencies to use tilde versioning.
https://github.com/redwoodjs/sdk/pull/784
Author: @justinvdm  Merged: 2025-09-25T11:14:56Z

This change updates dependency specifiers from caret (^) to tilde (~) ranges for dependencies and devDependencies of `rwsdk`.

For a framework package, using caret ranges can introduce unintended breaking changes from dependencies when minor versions are automatically updated in applications. This can affect the stability of projects that consume the framework.

---

### PR #785 - fix(vite): Prevent re-optimization by defining all framework dependencies
https://github.com/redwoodjs/sdk/pull/785
Author: @justinvdm  Merged: 2025-09-25T13:48:42Z

#### Problem

The dev server would crash with the error `Internal server error: There is a new version of the pre-bundle...` during development.

This was a side effect of a fix in PR #775. To support 'use client' and 'use server' directives in third-party packages, our build process transforms code in `node_modules`, which requires injecting imports to `rwsdk` modules. In a monorepo, a transformed dependency can be hoisted to the root, while the `rwsdk` package itself is located in a nested project's `node_modules`.

To handle this inverted resolution path, we introduced custom resolution logic in a vite plugin in RedwoodSDK. While this fixed the resolution failure, it also created a limitation. Once Vite could find an initial `rwsdk` module, its static analysis could not always discover the framework's entire internal dependency graph.

When a module missed during the initial scan (e.g., `rwsdk/constants`) was requested at runtime, Vite would trigger a re-optimization to create a new dependency bundle. This caused the running server code, which still referenced the old bundle, to become inconsistent with Vite's module map, leading to the crash.

#### Solution

This is addressed by explicitly defining all public `rwsdk` entry points in each environment's `optimizeDeps.include` list (`worker`, `client`, and `ssr`). This provides Vite with a complete and accurate dependency map upfront, ensuring that all framework modules are pre-bundled from the start. This prevents any runtime discoveries that would lead to the re-optimization and subsequent server error.

---

### PR #786 - fix(streaming): Ensure Early Hydration with Suspense-Aware Stream Interleaving
https://github.com/redwoodjs/sdk/pull/786
Author: @justinvdm  Merged: 2025-09-25T20:15:57Z

### Context

Previously, the framework rendered the `<Document>` shell and the application content in two separate server passes. It then stitched the two resulting HTML streams together. This was done to solve a `useId` hydration mismatch by preventing the document's render from interfering with the app's render.

### Problem: Blocked Hydration with Suspense

While this approach fixed the `useId` issue, it caused a problem with Suspense. The stream stitching would wait for the entire application stream to complete before sending the rest of the document.

If the application used `<Suspense>`, React would pause the app stream to wait for data. This pause meant the rest of the document stream, including the `<script>` tag for client-side hydration, was also delayed. The UI shell would appear in the browser, but it would not be interactive until all data fetching was finished.

### Solution: Interleaving Streams via RSC Payload Markers

This change updates the stream stitching to be aware of Suspense boundaries.

The solution works by injecting a marker component (`<div id="rwsdk-app-end" />`) directly into the RSC payload on the server. Because this marker is part of the payload, it is present in both the server-side HTML render and the client-side component tree, which guarantees structural consistency and prevents hydration errors.

A utility then uses this marker in the HTML stream to interleave the document and application streams. It sends the document head, then the initial app content (up to the marker), then the *rest of the document body* (including the client script), and only then streams the suspended content from the app before finally closing the document.

This ensures the client script is sent to the browser as soon as the initial UI is ready, making the page interactive right away, without re-introducing `useId` bugs or relying on brittle implementation details of React's streaming format.

For a detailed explanation, see the updated [Hybrid Rendering documentation](https://github.com/redwoodjs/sdk/blob/6cf5885906cba0ecb97b4100e1a979e9f7c0d9ad/docs/architecture/hybridRscSsrRendering.md).

---

### PR #787 - fix(streaming): Extend early hydration fix to renderToStream API
https://github.com/redwoodjs/sdk/pull/787
Author: @justinvdm  Merged: 2025-09-26T07:42:25Z

### Context: The Previous Fix in `v1.0.0-alpha.17`

In a recent change ([#786](https://github.com/redwoodjs/sdk/pull/786)), we fixed a regression where client-side components would not become interactive until all server-side `<Suspense>` boundaries had resolved. The solution involved injecting a marker component into the RSC payload, allowing our stream-stitching logic to send the client hydration script before the full application stream had completed.

### Problem: Regression for `renderToStream` Users

That fix was implemented within our high-level `defineApp` helper. This meant that users who bypassed this helper and used the lower-level `renderToStream` API directly did not receive the marker in their RSC payload.

As a result, they experienced a worse regression: the entire UI would remain blank until the suspended data was ready, as the stream-stitching logic had no marker to guide its interleaving process and would wait for the entire app stream to finish.

### Solution: Centralizing the Marker Injection

This change moves the marker-injection logic from the `defineApp` helper in `worker.tsx` down into the `renderToRscStream.tsx` utility.

Because `renderToRscStream` is used by both the high-level helper and direct API calls, this change ensures that the marker is present in the RSC payload regardless of which rendering path is taken. This restores correct, non-blocking hydration behavior for all users.

A new end-to-end test has also been added to specifically cover the `renderToStream` use case with `<Suspense>`, ensuring this behavior is protected against future regressions.

---

### PR #788 - fix: Include rwsdk worker deps in ssr optimizeDeps.include
https://github.com/redwoodjs/sdk/pull/788
Author: @justinvdm  Merged: 2025-09-26T09:31:53Z

Same as #785, but this time for adding `rwsdk/<worker_deps>` to SSR environment's `optimizeDeps.include`

---

