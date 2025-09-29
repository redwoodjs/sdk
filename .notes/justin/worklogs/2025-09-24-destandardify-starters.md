# Work Log: Destandardize Starters

**Date:** 2025-09-24

## Plan

The process will be broken down into four main parts: restructuring the starters, updating codebase references, updating documentation, and updating the `create-rwsdk` tool.

### 1. Restructure Starters

The current structure is `/starters/minimal` and `/starters/standard`. The plan is to remove `standard` and simplify the directory structure for the remaining starter.

- **Delete the `standard` starter:** Remove the `/starters/standard` directory entirely.
- **Relocate and rename `minimal` starter:**
    - The `starters/minimal` directory will be moved to the monorepo root and renamed to `starter`. The `/starters` directory will then be empty and can be removed.
    - This simplifies the path and establishes a single, clear starter for the project.

### 2. Update Codebase References

With the removal of the `standard` starter and relocation of `minimal`, all references in the codebase must be updated.

- **Search and remove references:** Conduct a global search for "standard" to find and eliminate all references to the old starter. This includes CI configurations, scripts, and any other places it might be mentioned.
- **Update CI workflows:** Specifically, check `.github/workflows/smoke-test-starters.yml` and other CI files to remove any jobs, steps, or matrix options related to the `standard` starter.
- **Update paths:** Search for any hardcoded paths to `starters/minimal` and update them to point to the new `/starter` directory.

### 3. Update Documentation

The documentation needs to be updated to remove references to the `standard` starter and the associated tutorial.

- **Delete the tutorial:** The tutorial content, which is based on the `standard` starter, will be removed from the `docs`. This includes deleting the relevant files and removing any links to them from other documentation pages.
- **Identify references to "standard" starter:** I will perform a search within the `/docs` directory to find all mentions of the "standard" starter. A list of these files will be compiled so we can decide how to best update them.

### 4. Update `create-rwsdk` Tool

The `create-rwsdk` tool, which is in a separate repository, needs significant changes to align with the single-starter model.

- **Simplify template logic:**
    - In `index.js`, remove the `TEMPLATES` object.
    - The logic for selecting a template will be removed.
- **Update commands and options:**
    - Remove the `-t, --template` option from the `create` command.
    - Remove the `list` command entirely, as there is only one template.
- **Modify download logic:** Update the project creation logic to download the single `starter` template from GitHub releases. The download URL construction will need to be adjusted.
- **Update `README.md`:** Revise the README to remove all information about multiple templates, the `--template` option, and the `list` command. The documentation should reflect the simplified usage.
- **Update `CHANGELOG.md`:** Add a new entry for these breaking changes.
- **Update `TODO.md`:** Mark related tasks as complete if they are no longer relevant.

### 5. Integrate Passkey Authentication into SDK

The authentication functionality previously in the `standard` starter will be moved from the `passkey-addon` repository into the `rwsdk` package itself, making it available as an optional, integrated feature. This involves creating new SDK entry points, refactoring the `passkey-addon` code, and documenting the setup process for the user.

- **Create new SDK entry points**: In the `sdk/package.json` file, define two new exports:
    - `rwsdk/passkey/worker`: For server-side utilities, including the Durable Object and authentication functions.
    - `rwsdk/passkey/client`: For the client-side hook (`usePasskey`) that will simplify the implementation of passkey authentication in the UI.

- **Port and refactor `passkey-addon` code**:
    - Move the core logic from `passkey-addon` into `sdk/src/passkey`.
    - **Server-side**: The worker-side code will export the passkey functions (`startPasskeyRegistration`, `finishPasskeyRegistration`, etc.), the `PasskeyDurableObject`, and the default database `migrations`.
    - **Client-side**: Create a `usePasskey` hook that abstracts the multi-step registration and login flows. It will return `login` and `register` functions that accept a `username` and handle the client-side part of the WebAuthn ceremony.
    - **API Update**: Refactor the ported code to use `requestInfo.response.headers` for setting headers, replacing the deprecated `requestInfo.headers`.

- **Update Authentication Documentation**:
    - Overhaul `docs/src/content/docs/core/authentication.mdx`.
    - Remove all references to the `standard` starter.
    - Provide a step-by-step guide for users to add passkey authentication to their projects. This guide will cover:
        - Manual `wrangler.jsonc` configuration for the `PasskeyDurableObject` and D1 database.
        - How to set up the worker using the exported `setupPasskeyAuth` middleware.
        - An example of how to implement a login UI using the `usePasskey` hook.
        - Instructions on how to extend the `PasskeyDurableObject` to add custom database migrations, with an example of spreading the provided default migrations.

- **Add Playground Example**:
    - In the `playground/hello-world` project, add a new login page and component.
    - This example will use the new `rwsdk/passkey/client` and `rwsdk/passkey/worker` modules to implement a fully functional passkey login flow.
    - This will serve as a practical test case and a reference implementation for users.

### 6. Rename "minimal" to "starter"

- Throughout the codebase, documentation, and any other relevant files, all remaining occurrences of the name "minimal" will be replaced with "starter" to reflect its new role as the one and only starter template.

### 7. Documentation Cleanup

The following files in the `docs` directory contain references to the "standard" starter and will need to be updated:

- `docs/src/content/docs/core/database.mdx`
- `docs/src/content/docs/core/authentication.mdx`
- `docs/astro.config.mjs`
- `docs/src/content/docs/reference/create-rwsdk.mdx`
- `docs/src/content/docs/index.mdx`
- `docs/src/content/docs/guides/frontend/storybook.mdx`
- `docs/src/content/docs/guides/frontend/og-images.mdx`
- `docs/src/content/docs/guides/frontend/documents.mdx`
- `docs/src/content/docs/core/storage.mdx`
- `docs/src/content/docs/core/security.mdx`
- `docs/src/content/docs/core/routing.mdx`

## Status Update

### Completed Tasks

- **1. Restructure Starters**:
  - [x] Deleted the `standard` starter directory from `/starters`.
  - [x] Moved `starters/minimal` to the monorepo root and renamed it to `starter`.
  - [x] Deleted the now-empty `starters` directory.
- **2. Update Codebase References**:
  - [x] Updated `scripts/cleanup-test-workers.sh` to replace `minimal` and `standard` test patterns with `starter`.
  - [x] Updated `sdk/scripts/ci-smoke-test.sh` to remove the `--starter` argument and hardcode the path to the new `starter` directory.
  - [x] Updated `CONTRIBUTING.md` to refer to the single `starter` and reflect the simplified smoke test command.
  - [x] Updated `sdk/SMOKE-TESTING.md` to remove an example that referenced the `standard` starter.
  - [x] Updated `.github/workflows/smoke-test-starters.yml` to remove the multi-starter matrix and simplify the CI job to only test the `starter`.
  - [x] Updated `sdk/scripts/release.sh` to copy from the new `starter` directory during the release smoke test.
  - [x] Updated `scripts/setup-wrangler-auth.sh` to use the `wrangler.jsonc` from the new `starter` directory.
- **3. Update `create-rwsdk` Tool**:
  - [x] Simplified `index.js` by removing all logic for multiple templates, including the `list` command and `--template` option.
  - [x] Updated `README.md` to reflect the simplified, single-starter functionality.
  - [x] Updated `CHANGELOG.md` with a new major version, documenting the breaking changes.
  - [x] Deleted the outdated `TODO.md`.
- **4. Integrate Passkey Authentication into SDK**:
  - [x] Added `rwsdk/passkey/worker` and `rwsdk/passkey/client` entry points to `sdk/package.json`.
  - [x] Ported the necessary logic (database, Durable Object, functions, setup) from the `passkey-addon` into a new `sdk/src/passkey` directory.
  - [x] Refactored the ported code in `setup.ts` and `functions.ts` to use `requestInfo.response.headers`.
  - [x] Created the `usePasskey` hook in `sdk/src/passkey/client.ts` to provide a simple client-side API.
  - [x] Added a new `passkey` playground example by copying `hello-world` and implementing the full authentication flow, including UI, worker middleware, Durable Object configuration, and E2E tests.
- **5. Rename "minimal" to "starter"**:
  - [x] Updated all remaining occurrences of "minimal" to "starter" across all project files, including READMEs, documentation, and the starter's own `package.json`.
- **6. Documentation Cleanup**:
  - [x] Overhauled `docs/src/content/docs/core/authentication.mdx` with a new, comprehensive guide for the integrated passkey feature.
  - [x] Deleted the tutorial directory (`docs/src/content/docs/tutorial`) and removed it from the `docs/astro.config.mjs` sidebar.
  - [x] Updated `docs/src/content/docs/core/database.mdx`, `guides/frontend/storybook.mdx`, `guides/frontend/documents.mdx`, and `core/security.mdx` to remove references to the "standard" starter and provide generic, starter-agnostic examples.
  - [x] Reviewed all other identified documentation files and confirmed no changes were needed.

### Architectural Journey: Integrating Passkey Authentication

This section details the evolution of the architectural decisions made for the passkey integration.

#### Architectural Shift: Passkey DB Ownership

A key challenge was identified in the passkey integration: **database ownership**.

**The Problem:** The initial implementation placed the passkey database schema (`migrations.ts`) and data access functions (`createUser`, `getCredentialById`, etc.) inside the SDK. This is a flawed approach because it forces a specific data model onto the user and assumes we can own their database schema. A user's data model is their own concern; they may have different fields, existing user tables, or different database technologies entirely.

**The Solution: Dependency Injection**

To solve this, we will refactor the passkey feature to use a dependency injection pattern. This creates a clear contract between the SDK and the user's code, establishing the correct "split point":

1.  **User Owns the DB:** The entire database layer—including migrations, the `db.ts` file, and all data access functions—will be moved out of the SDK and into user-land (in this case, the `playground/passkey` example). The user is responsible for implementing a "DB API" that provides a set of required functions (e.g., `createUser`, `createCredential`).

2.  **SDK Consumes the DB API:**
    *   The SDK's `setupPasskeyAuth` function will be modified to accept the user's DB API object as an argument: `setupPasskeyAuth(passkeyDb)`.
    *   This setup function will attach the user's `passkeyDb` object to the globally available `requestInfo` context, making it accessible throughout the request.

3.  **SDK Functions Use the Injected API:** The SDK's core passkey functions (`finishPasskeyRegistration`, etc.) will no longer import database functions directly. Instead, they will call them from the context: `requestInfo.rw.passkeyDb.createUser(...)`.

This approach gives the user full control over their database implementation while still benefiting from the complex WebAuthn logic provided by the SDK. It's a more flexible and robust architecture.

#### Strategy: Providing Defaults for Common Patterns

**Problem:** While the dependency injection pattern is flexible, it requires users to copy and maintain a significant amount of boilerplate for the database and session management, even for a standard setup. This creates friction for users who just want a working passkey implementation without writing custom persistence logic.

**Solution: Default Factory Functions**

To solve this, I will introduce "factory functions" within the SDK that create default, production-ready implementations for the passkey database and session store. Users can use these defaults out-of-the-box with zero configuration, or provide options to customize them. This preserves the flexibility of the architecture while drastically improving the developer experience for common use cases.

1.  **`createDefaultPasskeyDb(options)`:**
    *   This function will be exported from the SDK and will return a complete passkey DB API object (`createUser`, `getCredential`, etc.), backed by a SQLite Durable Object.
    *   It will accept an `options` object:
        *   `durableObject`: The Durable Object namespace binding. (Defaults to `env.PASSKEY_DURABLE_OBJECT`)
        *   `name`: The name for the singleton DO instance. (Defaults to `"passkey-main"`)

2.  **`createDefaultSessionStore(options)`:**
    *   This function will return a session store instance, also backed by a Durable Object.
    *   It will accept an `options` object:
        *   `durableObject`: The Durable Object namespace binding. (Defaults to `env.SESSION_DURABLE_OBJECT`)

3.  **Updated `setupPasskeyAuth(options)`:**
    *   The primary `setupPasskeyAuth` function will be updated to orchestrate these defaults.
    *   It will accept an `options` object:
        *   `passkeyDb`: A user-provided DB API. (If not provided, it will default to calling `createDefaultPasskeyDb()`).
        *   `sessions`: A user-provided session store. (If not provided, it will default to calling `createDefaultSessionStore()`).

This design allows for a simple, zero-config setup for most users (`setupPasskeyAuth()`), while still enabling advanced users to override any part of the implementation (`setupPasskeyAuth({ passkeyDb: myCustomDb })`).

#### Decision: The Co-Located Addon (aka "Bundled Addon")

After extensive back-and-forth, we have landed on a final architecture that we believe correctly balances developer experience, flexibility, and long-term maintainability. The core challenge was providing a first-class, "batteries-included" authentication solution without creating a "black box" that users couldn't customize, and without creating a versioning nightmare.

Here is a summary of the approaches we considered and why we ultimately chose the "Co-located Addon" model.

##### Attempt 1: In-SDK Defaults with Dependency Injection

- **The Idea:** Provide `createDefaultPasskeyDb` and `createDefaultSessionStore` functions within the SDK. The main `setupPasskeyAuth` function would use these by default, but allow advanced users to pass in their own custom implementations.
- **Why we rejected it:** This created a rigid API contract. The user's database logic would have to conform to *our* specific interface (e.g., a function named `createUser` with a specific signature). This is inflexible and often creates more work for the user (writing adapters) than it saves. More importantly, the default implementation was a "black box"—the schema and logic were hidden inside the SDK's compiled code, making it impossible for a user to inspect or modify.

##### Attempt 2: External Addon (The Original Approach)

- **The Idea:** Keep the entire passkey implementation in a separate repository. The user (or an AI agent) would follow a `README` to copy the files into their project.
- **Why we rejected it:** While this model correctly gives the user full ownership of the code, it creates a critical **versioning and stability crisis**. There is no way to guarantee that the `main` branch of the addon is compatible with the version of the SDK a user has installed. A breaking change in a core SDK API could silently break every project using the addon. It also feels disconnected and less "official," undermining the goal of making auth a first-class feature.

---

##### The Solution: A Co-located, Version-Locked Addon

The final, chosen approach combines the best of both worlds.

- **What it is:** The entire passkey implementation (database, server functions, UI, etc.) will live as source code boilerplate inside an `sdk/addons/passkey` directory within the SDK monorepo. This directory is **not** part of the SDK's compiled code, but it is **published with the package** to NPM.

- **Why it's the right choice:**
    1.  **Atomic Versioning (The Most Important Point):** The addon is versioned and published *with* the SDK. The boilerplate in `rwsdk@1.2.0` is guaranteed to work with the `rwsdk@1.2.0` core library because they are from the same commit and tested together. This completely solves the stability problem.
    2.  **A Cohesive Documentation Story:** We can now officially document the auth solution. The docs for a specific SDK version can point to a **permanent, version-locked URL** for the addon's instructions: `.../sdk/v1.2.0/addons/passkey/README.md`. This makes it feel like an official, bundled feature, not a "jutting out thing."
    3.  **Total User Ownership:** The workflow remains the same: the user copies the source code into their project. It becomes *their* code. They are free to modify the schema, change the function signatures, and customize the UI. There is no black box and no rigid API contract.
    4.  **Enables Robust End-to-End Testing:** Because the addon lives in the same repository, we can create a playground example that applies the addon and run our full E2E test suite against it, ensuring this critical feature is always compatible with the core SDK.
    5.  **Keeps the Core SDK Clean:** The SDK's public API surface remains minimal and un-opinionated about authentication. It provides the generic primitives, and the addon provides a complete, but fully user-owned, implementation.

This is because it is both versioned and testable.

##### Attempt 4: A Docs-First Approach with a CLI Helper

Upon reflection, creating a robust E2E test that programmatically uses an AI agent to apply the addon feels like a potential rabbit hole that could derail the immediate goal. While it remains a good long-term objective, a more pragmatic approach is needed now.

The decision is to pivot to a docs-first strategy. The primary way a user will add passkey authentication is by following the official documentation. The `playground/passkey` example will be removed in favor of this approach, with the functionality being manually tested for now.

To solve the critical issue of ensuring users get the correct, version-locked instructions for the addon, a CLI helper will be created. A command like `npx rw-scripts addon passkey` will be added. This command will read the `README.md` from within the installed `rwsdk` package (`node_modules/rwsdk/addons/passkey/README.md`) and print its contents directly to the console.

This approach has several advantages:
- It provides a single, reliable source of truth for instructions.
- The instructions are guaranteed to be in sync with the user's installed SDK version.
- The command is simple for both human users and AI agents to execute, fulfilling the goal of having an AI-friendly workflow.
- It avoids the complexity and non-determinism of building an AI-driven E2E test at this stage.

The authentication documentation will be completely overhauled to guide users to this new command.

##### Attempt 5: Decoupling the Addon from the NPM Package

A refinement to the docs-first approach is to avoid shipping the addon source code within the published `rwsdk` npm package. This keeps the package lean for all users, especially those not using the passkey feature.

The new plan is as follows:
1. The `sdk/addons` directory will not be included in the files published to npm. It will exist only in the GitHub repository, versioned with git tags.
2. The `rw-scripts addon passkey` command will be modified. Instead of reading a local file, it will determine the currently installed version of `rwsdk`. It will then use this version to construct and print the exact GitHub URL for the addon's `README.md` at that specific git tag.
3. The documentation will be updated to reflect this. It will instruct users to run the command to get a version-locked URL. It will also provide a static link to the `README.md` on the `main` branch for users who wish to browse the latest version.

This approach maintains the key benefit of version-locking the instructions to the user's installed SDK version while significantly reducing the size of the installed package. The workflow remains simple for both users and AI agents, who can be instructed to fetch content from the provided URL.

##### Attempt 6: Per-Addon Dependency Management

A further refinement is how to handle addon-specific dependencies. A single `package.json` at the `addons` root is insufficient for managing the unique dependencies of multiple addons.

The decision is to adopt a per-addon configuration:
1. Each addon directory (e.g., `addons/passkey/`) will contain its own minimal `package.json` file.
2. The purpose of this `package.json` is solely to declare the addon's specific npm dependencies. It will not be used for publishing the addon itself.
3. The addon's `README.md` will be updated to instruct users to check this `package.json` and install the listed dependencies into their own project.

This makes each addon's requirements explicit and self-contained, which is a more robust and scalable pattern.

## Release and Migration Strategy

The following sections have been consolidated from previous entries to form the final, agreed-upon strategy.

### The Problem: Coordinating a Multi-Part Release

The changes in this branch affect multiple parts of the ecosystem that need to be released in a coordinated manner:
1.  **`rwsdk`**: The core package is moving towards a `1.0.0` pre-release (e.g., `1.0.0-alpha.x`) with breaking changes.
2.  **`create-rwsdk`**: The CLI tool needs to be updated to provide the new single `starter` template.
3.  **The Starter Template**: The artifact downloaded by `create-rwsdk` is now built from the `1.0.0` pre-release branch and will have dependencies pinned accordingly.
4.  **Documentation**: The docs have been overhauled to match the `1.0.0` changes.

A simple "big bang" release—updating the `latest` tag on npm for both `rwsdk` and `create-rwsdk` simultaneously—is risky. It could break existing users' projects unexpectedly and doesn't align with the goal of a gradual rollout for pre-release software. The central question is: how do we get the new, better version to new users without disrupting existing ones?

### Proposed Solution: An "Implicit Pre-release" Path

The initial proposal was to leverage `create-rwsdk` as the main entry point for new users, guiding them onto the pre-release track by default.

1.  **`create-rwsdk` Logic Change**: Modify the CLI to fetch the most recent release from GitHub, **including pre-releases**. It would then download the `starter` tarball asset from that specific pre-release.
2.  **User Experience**: New users would run the simple `npx create-rwsdk my-app` command and automatically receive the latest `1.0.0-alpha.x` starter. The CLI would mention that it's installing a pre-release for transparency.
3.  **Isolating Existing Users**: The `latest` tag on npm for `rwsdk` would remain on the stable `0.x` version. This prevents existing projects from accidentally upgrading to a breaking version when they run `pnpm install`.

### Refinement: Addressing the Needs of Existing Users

While the above strategy works well for new users, a critical consideration was raised: what is the experience for existing users, particularly those who built their projects on the old `standard` starter?

The key insight is that the code generated by the old starter is now **the user's own code**. It is not a deprecated API that we are removing. Therefore, forcing them through a "migration" is the wrong mental model. Their existing authentication implementation, based on Prisma, will continue to work. They are not required to change anything.

This led to a refined, more user-centric strategy that respects their existing codebase while still informing them of the project's new direction.

### Agreed-Upon Strategy

The final plan combines the "implicit pre-release" path for new users with a clear, supportive path for existing users, centered around a new migration guide and an escape-hatch flag in the CLI.

1.  **Implement the `--legacy` flag in `create-rwsdk`**:
    *   The default command (`npx create-rwsdk my-app`) will fetch the latest pre-release from GitHub.
    *   A new flag, `npx create-rwsdk my-app --legacy`, will be added. This will force the CLI to use the old logic, fetching only the latest *stable* release. This provides a supported path for anyone (including the internal team) who explicitly needs the older `0.x` version.

2.  **Create a Two-Part Migration Guide in the Docs**: A new page, "Migrating from 0.x to 1.x", will be created with two distinct sections:
    *   **Part 1: Required Migration Steps**: This section will be short and cover the true, unavoidable breaking changes. For example, it will instruct users on how to update their `package.json` to explicitly include peer dependencies like `react`, which is now required. This is the "must-do" list to prevent errors after updating the `rwsdk` package version.
    *   **Part 2: Optional Refactoring Guide**: This section will be informational and will:
        *   Explain that the `standard` starter and its tutorial have been removed in favor of a single `starter` with integrated passkey authentication.
        *   Reassure users that their existing, generated authentication code is theirs and will continue to work.
        *   Provide a guide for users who *want* to adopt the new, officially supported passkey pattern. This guide will walk them through refactoring their existing code to use the `setupPasskeyAuth` middleware and the `usePasskey` client-side hook, referencing the main authentication documentation.

This refined strategy provides a smooth onboarding path for new users, a clear and non-disruptive upgrade path for existing users, and the necessary flexibility for developers to manage different versions.## What's Changed
* fix: Unify request handling for pages and RSC actions by @justinvdm in https://github.com/redwoodjs/sdk/pull/715


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v0.3.8...v1.0.0-alpha.0

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
## What's Changed
* feat(deps): Switch to peer dependency model for React by @justinvdm in https://github.com/redwoodjs/sdk/pull/708


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.0...v1.0.0-alpha.1

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
## What's Changed
* feat: Upgrade to Vite v7 by @justinvdm in https://github.com/redwoodjs/sdk/pull/720


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.1...v1.0.0-alpha.2
**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.2...v1.0.0-alpha.3
## What's Changed
* 📝 Updates to the Jobs Form page (tutorial) by @ahaywood in https://github.com/redwoodjs/sdk/pull/724
* 📝 Updated the Contacts section of the tutorial by @ahaywood in https://github.com/redwoodjs/sdk/pull/727
* fix: Update starter worker types by @justinvdm in https://github.com/redwoodjs/sdk/pull/729
* ✨ Added a favicon to the minimal and standard starter by @ahaywood in https://github.com/redwoodjs/sdk/pull/728
* tests: Add more unit tests by @justinvdm in https://github.com/redwoodjs/sdk/pull/721
* chore: Use npm pack tarball of sdk for smoke tests by @justinvdm in https://github.com/redwoodjs/sdk/pull/722
* Finished making updates to the Jobs Details page of the tutorial by @ahaywood in https://github.com/redwoodjs/sdk/pull/731
* fix: Avoid duplicate identifiers in build during linking by @justinvdm in https://github.com/redwoodjs/sdk/pull/732


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.3...v1.0.0-alpha.4
## What's Changed
* fix: Correct vendor module paths in dev directive barrel file by @justinvdm in https://github.com/redwoodjs/sdk/pull/734


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.4...v1.0.0-alpha.5
## What's Changed
* fix: Restore short-circuiting behavior for routes by @justinvdm in https://github.com/redwoodjs/sdk/pull/738


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.5...v1.0.0-alpha.6
## What's Changed
* fix: Use permissive range for React peer dependencies by @justinvdm in https://github.com/redwoodjs/sdk/pull/745
* chore: Greenkeeping configuration by @justinvdm in https://github.com/redwoodjs/sdk/pull/748
* infra: Playground + E2E test infrastructure by @justinvdm in https://github.com/redwoodjs/sdk/pull/753
* infra: CI improvements by @justinvdm in https://github.com/redwoodjs/sdk/pull/755
* fix: useId() mismatch between SSR and client side by @justinvdm in https://github.com/redwoodjs/sdk/pull/752


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.6...v1.0.0-alpha.7
## What's Changed
* fix: Scope middleware to prefixes by @justinvdm in https://github.com/redwoodjs/sdk/pull/759


**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.7...v1.0.0-alpha.8
## What's Changed
* fix(e2e): ensure test workers are deleted after tests by @justinvdm in https://github.com/redwoodjs/sdk/pull/760
* fix(e2e): Disable inspector port in tests to prevent collisions by @justinvdm in https://github.com/redwoodjs/sdk/pull/761
* chore: CI Worker cleanup by @justinvdm in https://github.com/redwoodjs/sdk/pull/764
* chore: Fix E2E flake by @justinvdm in https://github.com/redwoodjs/sdk/pull/765
* infra: Better CI structure by @justinvdm in https://github.com/redwoodjs/sdk/pull/766
* fix: Account for `use strict` when finding client/server directives by @justinvdm in https://github.com/redwoodjs/sdk/pull/762
* infra: Add retry mechanism for Chrome installation. by @justinvdm in https://github.com/redwoodjs/sdk/pull/767
* fix(deps): update starter-peer-deps by @renovate[bot] in https://github.com/redwoodjs/sdk/pull/746
* infra: Clean up node_modules and lockfiles before installing dependencies. by @justinvdm in https://github.com/redwoodjs/sdk/pull/770
* infra: Fix CI runs for yarn by @justinvdm in https://github.com/redwoodjs/sdk/pull/772

## New Contributors
* @renovate[bot] made their first contribution in https://github.com/redwoodjs/sdk/pull/746

**Full Changelog**: https://github.com/redwoodjs/sdk/compare/v1.0.0-alpha.8...v1.0.0-alpha.9

## Release Strategy and Next Steps

### Release Strategy Discussion and Rationale

A significant portion of this work involved not just the technical implementation, but also devising a release strategy that could safely introduce these breaking changes without disrupting existing users or creating an unmanageable support burden, especially with the weekend coming up.

My thought process evolved through several stages:

1.  **Initial Problem**: The core challenge is coordinating releases for `rwsdk`, `create-rwsdk`, and the documentation. The primary goal is to get the new, improved `1.x` pre-release into the hands of new users without forcing an upgrade on stable `0.x` users.

2.  **Initial Idea - "Implicit Pre-release"**: A first thought was to modify `create-rwsdk` to fetch the latest pre-release from GitHub by default. This would give new users the best version automatically.

3.  **Refinement for Existing Users**: However, that approach neglected the migration path for existing users, especially those on the `standard` starter.

4.  **Crucial Correction - The Database Issue**: The initial migration plan mistakenly suggested that users should remove their old Prisma-based database setup. This is a critical flaw, as users cannot be expected to delete their data. This insight was pivotal.

5.  **The Adapter Pattern Solution**: A better approach is an adapter pattern. We can refactor the new passkey system to accept a data adapter, allowing users to keep their existing Prisma/D1 database and simply write a thin translation layer to connect it to the new authentication logic.

6.  **Addressing Time Constraints and "Big Bang" Releases**: Given my limited availability over the upcoming weekend, a "big bang" release on Monday felt risky. I wanted to merge the code now for peace of mind but delay the public-facing "launch" until I was fully available.

7.  **Strategy - "Code-First, Docs-Later"**: After considering various ways to handle the documentation (a `docs-next` folder, separate branches), the best path forward seems to be a hybrid "Isolate and Stage" approach. This provides the best of both worlds:
    *   **Code Merge First**: All functional code changes will be merged into `main` first, but in a "dark" state. `create-rwsdk` will default to the `--legacy` behavior, so no users are affected.
    *   **Isolate Docs**: The documentation changes will be temporarily removed from the main PR and staged for a separate, atomic merge.
    *   **Controlled Launch**: The launch on Monday will consist of two small, low-risk actions: updating the default behavior of `create-rwsdk` and merging the prepared documentation PR.

##### Attempt 7: Unifying and Simplifying the Release Process

The final series of refinements focused on creating a single, cohesive release process for all parts of the ecosystem (SDK, starter, and addons) and simplifying the underlying scripts and CI workflows.

**The Problem:** The release process, while functional, contained legacy complexity and inconsistencies.
- The `sdk/scripts/release.sh` script had logic to amend its own release commit to update dependencies across the monorepo, which was a brittle and confusing pattern.
- The distribution mechanism for addons (`tiged` from a git tag) was fundamentally different from the distribution for the starter (`.tar.gz` artifact attached to a GitHub Release).
- Documentation for the release process was scattered between `CONTRIBUTING.md` and the `release.sh` script's help text.

**The Solution: A Unified Tarball-Based Strategy**

The decision was to standardize on a single distribution method and simplify the CI/CD pipeline accordingly.

1.  **Tarball Artifacts for Everything**: The core principle is that all distributable, non-npm assets (the starter and all addons) are packaged into versioned `.tar.gz` files and attached to the corresponding GitHub Release.
    - The `.github/workflows/release-starters.yml` workflow was renamed to `release-artifacts.yml`.
    - This workflow was updated to package not only the `starter` but also to loop through and package each individual addon in the `addons/` directory.

2.  **Simplified Addon CLI**: The `rw-scripts addon` command was completely refactored.
    - The dependency on `tiged` was removed.
    - The script now behaves like `create-rwsdk`: it determines the user's installed `rwsdk` version, constructs the URL to the appropriate `addon-name-<version>.tar.gz` file on the GitHub Release page, downloads it, and decompresses it.

3.  **Simplified SDK Release Script**: With the starter and addon packaging handled by a separate, downstream workflow, the main `sdk/scripts/release.sh` was significantly simplified.
    - All logic for updating monorepo dependencies and amending the release commit was removed.
    - The script's sole responsibility is now to version, commit, build, smoke test, publish, tag, and push the `rwsdk` package. This makes the commit history linear and much easier to understand.

4.  **Consolidated Documentation**:
    - A new, comprehensive architecture document, `docs/architecture/releaseProcess.md`, was created to be the single source of truth for the entire end-to-end release process.
    - `CONTRIBUTING.md` was updated to remove the detailed procedural steps and instead link directly to the new architecture document.

This final architecture provides a clean, consistent, and robust model for the entire ecosystem. It simplifies maintenance and makes the process of how users receive code—whether for a new project or an addon—predictable and reliable.

## Things to Address (Final Review)

- [x] **Update `migrating.mdx`**:
    - [x] Change hardcoded dependency versions to dynamic ones (`@rc`, `@latest`).
    - [x] Add `@cloudflare/workers-types` to dev dependencies.
    - [x] Clarify the D1-to-Durable-Object migration complexity in the passkey refactoring guide.
    - [x] Correct the description of passkey delivery (addon vs. direct SDK export).
- [x] **Update `authentication.mdx`**:
    - [x] Reframe introduction to high-level (addon) vs. low-level (session API) paths.
    - [x] Add an "Experimental" badge to the Passkey Authentication section.
    - [x] Add a brief explanation of what Passkeys/WebAuthn are.
    - [x] Remove/tone down "bold claims".

## Final Review (Part 2)

- [x] **Fix `smoke-test.yml`**:
    - [x] Reinstate the `setup-matrix` job for dynamic matrix generation.
    - [x] Change the job name to a static string to fix interpolation in `workflow_call`.
- [x] **Update `ci-smoke-test.sh`**:
    - [x] Correct the outdated help comment to remove the `--starter` argument.
- [x] **Update `release.yml`**:
    - [x] Modify release logic to mark `beta` releases as `--latest`.
- [x] **Update `release-artifacts.yml`**:
    - [x] Add a step to update `rwsdk` dependency in addon `package.json` files before packaging.
- [ ] **Verify Type-Checking Scripts**:
    - [ ] Run `pnpm typecheck:addons` and `pnpm typecheck:starter` to confirm they execute successfully.
- [ ] **Fix Addon Type Errors**:
    - [ ] Update addon `tsconfig.json` to include `jsx`, a modern `target`, and correct `types` for Cloudflare workers.
    - [ ] Add missing dependencies like `@types/react` to addon `package.json`.
    - [ ] Correct source code errors in the addon caught by `tsc`.
- [ ] **Perform Test Release**:
    - [ ] Run the release script with `test` to validate the entire CI/CD and packaging pipeline.

## Post-PR Implementation Issues and Fixes

After the main PR work was completed, several technical issues emerged that required resolution:

### Issue 1: Documentation Build Failures

**Problem**: The documentation build was failing due to broken image links and missing content after the tutorial removal.

**Resolution**:
- Removed broken image references from `docs/src/content/docs/core/hosting.mdx` and `docs/src/content/docs/guides/frontend/shadcn.mdx`
- Later restored the images by copying them from the old tutorial location to appropriate directories (`docs/src/content/docs/core/images/` and `docs/src/content/docs/guides/frontend/images/`)
- Updated image paths to use relative references (e.g., `./images/cloudflare-visit-website.png`)
- Fixed sidebar configuration in `docs/astro.config.mjs` by removing obsolete `core/database` entry and updating `core/database-do` to be labeled "Database"
- Deleted the old `docs/src/content/docs/core/database.mdx` page as requested

### Issue 2: Vite Version Compatibility Problems

**Problem**: Type compatibility issues between the SDK and starter due to different Vite versions. The SDK was built against Vite 6 while the starter used Vite 7, causing plugin type mismatches.

**Root Cause**: The error showed two different Vite versions in dependency paths:
- `vite@6.3.6_@types+node@24.5.2_...` (from SDK build)
- `vite@7.1.6_@types+node@22.14.0_...` (from starter)

**Resolution**:
- Added Vite 7.1.6 and `@cloudflare/vite-plugin@1.13.3` as dev dependencies in the SDK
- Aligned `@types/node` versions to use `~24.5.2` consistently across SDK and starter
- Rebuilt the SDK to ensure all plugins are compiled against the same Vite version

### Issue 3: E2E Test Import Errors

**Problem**: Playground e2e tests were failing with `Cannot find module 'rwsdk/e2e'` errors.

**Root Cause**: The SDK build was incomplete - the `dist/lib/e2e/` directory existed but was empty.

**Resolution**: Rebuilt the SDK after fixing the Vite compatibility issues, which resolved the missing e2e exports.

### Issue 4: CI Build Failure - Duplicate Function Export

**Problem**: CI was failing with duplicate `waitForHydration` function exports in `sdk/src/lib/e2e/testHarness.mts`.

**Resolution**: Removed the duplicate function definition to resolve the TypeScript compilation error.

### Issue 5: Passkey Addon Type Errors

**Problem**: Multiple TypeScript errors in the passkey addon code:
- Missing environment variable types
- `import.meta` usage with incorrect module setting
- Type mismatches in WebAuthn credential handling
- React event handling type issues
- Missing DOM type definitions

**Resolution**:
- Fixed `tsconfig.json` module setting from `es22` to `es2022`
- Updated `include` array to correctly reference `types/**/*.d.ts`
- Added `"DOM"` and `"DOM.Iterable"` to the `lib` array
- Fixed `publicKey` type handling with `credential.publicKey.slice()` to ensure proper `ArrayBuffer` backing
- Fixed React event handling by using `(e.currentTarget as HTMLInputElement).value`
- Re-added missing Durable Object namespace types to `env.d.ts`

### Issue 6: Smoke Test Workspace Dependency Error

**Problem**: Smoke tests were failing with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND` when trying to resolve `rwsdk@workspace:*`.

**Root Cause Analysis**: After extensive investigation, discovered that `ci-smoke-test.sh` was performing duplicate project setup:
1. The script was creating its own temp directory, copying starter files, and attempting to install the SDK
2. Then it called `pnpm smoke-test` which used `setupTarballEnvironment()` to do the same setup again
3. The first installation attempt failed because it was trying to install `rwsdk@workspace:*` from the copied starter in a temp directory with no workspace configuration

**Resolution**: 
- Simplified `ci-smoke-test.sh` to be a thin wrapper that only builds the SDK and calls `pnpm smoke-test`
- Removed all duplicate project setup, tarball creation, and installation logic from the script
- Updated smoke tests to use `setupTarballEnvironment()` consistently with e2e tests
- Added `yarn-classic` support back to e2e types to maintain compatibility

### Issue 7: Yarn Classic Type Compatibility

**Problem**: Type conflicts between smoke tests and e2e tests due to different `PackageManager` type definitions.

**Resolution**: Added `yarn-classic` support back to the e2e types to unify the type definitions across both test systems.

## Release Infrastructure Updates

### Test Release Branch Support

**Problem**: The release workflow was restricted to only run on the `main` branch, preventing test releases from feature branches.

**Solution**: Modified `.github/workflows/release.yml` to allow test releases from any branch while maintaining the restriction for production releases:
- Updated the job condition from `if: github.ref == 'refs/heads/main'` to `if: github.ref == 'refs/heads/main' || github.event.inputs.version_type == 'test'`
- This allows test releases to run from any branch while keeping patch, minor, and explicit releases restricted to `main`

### Artifact Upload for All Releases

**Problem**: The `release-artifacts.yml` workflow was excluding pre-release tags, preventing test releases and alpha versions from uploading starter and addon artifacts.

**Solution**: Removed the exclusion pattern `- "!v*.*.*-*"` from the workflow trigger, ensuring all tagged releases (including pre-releases and test releases) upload their artifacts to GitHub Releases.

## Create-RWSDK CLI Enhancements

### Version Selection and Default Behavior Changes

**Problem**: The `create-rwsdk` CLI needed to support specific version selection for testing and should default to pre-releases rather than stable releases to align with the project's direction toward 1.0.0.

**Implementation**:
- Added `--release <version>` option to allow specifying exact versions (e.g., `v1.0.0-alpha.1`)
- Removed the `--legacy` flag (no backwards compatibility needed since this is a breaking change)
- Changed `--version` to `--release` to avoid conflict with the standard version display flag
- Modified the release selection logic to handle three modes:
  - `--release v1.0.0-alpha.1` → uses that specific version
  - `--pre` → uses latest pre-release from GitHub  
  - Default → uses GitHub's "latest" release (which respects our beta-as-latest tagging strategy)

### Pre-release Versioning

**Decision**: Rather than releasing breaking changes as `3.0.0` immediately, we opted for a pre-release approach to allow testing and gradual adoption.

**Implementation**:
- Updated `create-rwsdk` to version `3.0.0-alpha.1`
- Updated the changelog to reflect this as an alpha release
- Moved the breaking changes from a released `3.0.0` section to the alpha release section

This approach allows us to:
1. Test the CLI changes with real SDK test releases
2. Publish to npm under the `@pre` tag for controlled distribution
3. Gather feedback before committing to the breaking changes in a stable release

### GitHub Release Integration Strategy

**Key Insight**: The default behavior leverages GitHub's `/releases/latest` API endpoint, which automatically respects the `--latest` flag we set in our release workflow. This creates a seamless integration:

1. **Beta Releases**: When we release `v1.0.0-beta.x`, our release workflow marks it with `--latest`, making it the "latest" release on GitHub
2. **CLI Default Behavior**: `create-rwsdk` (without flags) calls `/releases/latest`, automatically getting the beta release
3. **Pre-release Access**: Users can still access true pre-releases (alphas, etc.) with `--pre`
4. **Specific Versions**: Users can target exact versions for testing with `--release v1.0.0-alpha.20`

This eliminates the need for complex version detection logic in the CLI - GitHub's release system handles the "what is latest" decision based on our tagging strategy.

### Clarification on Beta Release Handling

A key clarification was made to the release process: `beta` releases, while technically pre-releases, must be treated as "latest" releases across the entire toolchain. This ensures that users on the stable track can receive beta updates seamlessly.

**Rationale**: Beta versions are considered feature-complete and are intended for wider testing before a general availability release. Marking them as `latest` encourages adoption and feedback from the main user base, which is critical for stabilizing a `1.0` release. Alphas, release candidates, and test builds, on the other hand, are for more targeted, internal, or opt-in testing and should not be presented as the default latest version.

**Implementation**:
- The `release.yml` workflow was confirmed to correctly apply the `--latest` flag to GitHub Releases for versions containing `-beta.`.
- The `sdk/scripts/release.sh` script was confirmed to correctly apply the `latest` npm tag to beta releases.
- The `release-artifacts.yml` workflow was updated to mark a release as a "pre-release" **only if** the version string contains a hyphen (`-`) and does **not** contain `-beta.`. This prevents beta releases from being visually tagged as pre-releases on the GitHub UI, avoiding user confusion.
- The architecture documentation was updated to reflect this specific rule, clarifying the distinction between beta and other pre-release types.

## Current Status

All identified issues have been resolved:
- Documentation builds successfully with restored images
- Vite compatibility issues are resolved with aligned versions
- E2E tests can import `rwsdk/e2e` successfully  
- CI builds pass without duplicate function errors
- Passkey addon compiles without TypeScript errors
- Smoke tests use the same proven infrastructure as e2e tests
- Both test systems use unified type definitions
- Release workflows support test releases from any branch
- All releases (including pre-releases) upload artifacts
- `create-rwsdk` supports specific version selection and defaults to pre-releases

The destandardification work is now technically complete and the release infrastructure is prepared for coordinated testing and deployment.

## PR Description

### Title: `refactor: Destructure starters and integrate passkey addon`

### Description

This PR restructures the starter templates and moves the passkey authentication functionality into a co-located addon. The `standard` and `minimal` starters are replaced by a single `starter`, and the passkey addon is now included in the SDK repository to ensure it is versioned and tested with the core package.

#### Changes

*   **Unified Starter Template**: The `/starters/standard` and `/starters/minimal` directories are removed and replaced by a single `/starter` directory at the monorepo root.
*   **Co-located Passkey Addon**: The passkey authentication code has been moved from the former `standard` starter into `sdk/addons/passkey`. It is now versioned and published with the SDK.
*   **`create-rwsdk` Updates**: The `create-rwsdk` tool is updated to download the new single `starter` from the latest pre-release. The `--template` flag is removed, and a `--legacy` flag is added to download the latest stable `0.x` release.
*   **Unified Release Artifacts**: The `release-artifacts.yml` workflow now packages the `starter` and all directories within `addons/` as `.tar.gz` files and attaches them to the GitHub Release.
*   **Addon CLI Helper**: A `rw-scripts addon` command is added. It downloads and extracts the corresponding versioned addon `.tar.gz` from the GitHub release assets.
*   **Documentation Updates**: The documentation is updated to reflect these changes, including a migration guide for `0.x` users and instructions for the passkey addon.
*   **New Welcome Page**: The development-mode iframe has been replaced with a self-contained `<Welcome />` React component. This component uses CSS modules for styling, has no external dependencies, and is designed to be easily deleted by the user.
