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
- `docs/architecture/ssrBridge.md`
- `docs/architecture/requestHandling.md`
- `docs/architecture/endToEndTesting.md`
- `docs/architecture/earlyHydrationStrategy.md`
- `docs/architecture/directiveTransforms.md`
- `docs/architecture/clientStylesheets.md`

### 8. Status Update

Here is a summary of the progress so far, cross-referenced with the tasks in this work log and my internal to-do list.

#### Completed Tasks

- **1. Restructure Starters**:
  - [x] Delete the `standard` starter.
  - [x] Relocate and rename `minimal` starter to `starter`.
- **2. Update Codebase References**:
  - [x] Search for and remove references to the `standard` starter (in scripts and markdown files).
  - [x] Update CI workflows to remove the `standard` option.
  - [x] Update all paths referencing `starters/minimal` to point to `/starter`.
- **3. Update Documentation**:
  - [x] Delete the tutorial.
  - [x] Identify and list all references to the "standard" starter in the docs.

#### Pending Tasks

- **4. Update `create-rwsdk` Tool**:
  - [ ] Simplify template logic in `index.js`.
  - [ ] Remove the `--template` option and the `list` command.
  - [ ] Update the download logic.
  - [ ] Update `README.md`, `CHANGELOG.md`, and `TODO.md`.
- **5. Integrate Passkey Authentication into SDK**:
  - [ ] Overhaul the authentication documentation.
  - [ ] Create new SDK entry points for passkey authentication.
  - [ ] Port `passkey-addon` code into `sdk/src/passkey`.
  - [ ] Refactor ported passkey code to use `requestInfo.response.headers`.
  - [ ] Create the `usePasskey` hook.
  - [ ] Add passkey authentication example to `playground/hello-world`.
- **6. Rename "minimal" to "starter"**:
  - [ ] Rename all remaining occurrences of "minimal" to "starter".
- **7. Documentation Cleanup**:
  - [ ] The files have been identified, but the content has not yet been updated.
