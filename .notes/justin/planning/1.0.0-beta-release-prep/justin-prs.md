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

### PR #729 - fix: Update starter worker types
https://github.com/redwoodjs/sdk/pull/729
Author: @justinvdm  Merged: 2025-09-15T02:41:13Z

Now that we are pinning deps for our starters, our CF worker types defs need to be newer versions to be compatible with the wrangler version we have pinned.

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

