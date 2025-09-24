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

## Release and Migration Strategy

With the core refactoring complete, the next challenge is to devise a release strategy that safely rolls out these significant changes to both new and existing users without causing disruption.

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

### Final Agreed-Upon Strategy

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

This refined strategy provides a smooth onboarding path for new users, a clear and non-disruptive upgrade path for existing users, and the necessary flexibility for developers to manage different versions.