# 2025-10-06: Renovate Docs and Infra Deps

## Problem

The Renovate PR for `docs-and-infra-deps` introduced several dependency updates. These updates caused two separate failures in the CI/CD pipeline: one in the GitHub Actions workflows and another in the Cloudflare Pages deployment for the documentation site.

## GitHub Actions Workflow Failures

### Observation

The `Code Quality`, `Smoke Tests`, and other workflows began failing with the error `Error: Unable to locate executable file: pnpm`. This coincided with the upgrade of the `actions/setup-node` action from `v4` to `v5`.

### Diagnosis and Fix

Version 5 of `actions/setup-node` automatically detects the project's package manager from the root `package.json` (`pnpm` in this case) and attempts to configure it. However, our workflows were set up to enable `corepack` (which makes `pnpm` available) *after* the `setup-node` step. The action was therefore running before `pnpm` was in the environment's `PATH`.

The solution was to modify the workflows to ensure `corepack` is enabled *before* `setup-node` runs.

**Changes Implemented:**

1.  Added a dedicated "Enable Corepack" step (`run: corepack enable`) before the "Setup Node.js" step.
2.  Added `cache: 'pnpm'` to the `setup-node` step to speed up dependency installation.
3.  Removed the redundant `corepack enable` from the subsequent `pnpm install` step.

This fix was applied to all relevant workflow files and resolved the GitHub Actions failures.

## Cloudflare Docs Deployment Failure

### Observation

After fixing the GitHub Actions workflows, the Cloudflare Pages deployment for the docs site started failing with a new error during the `astro build` step: `Dynamic require of "path" is not supported`.

The stack trace pointed to `@fujocoded/expressive-code-output`, which had been updated by Renovate from `0.0.1` to `0.1.0`.

### Attempt 1: Dynamic Import

**Hypothesis:** The error suggested a CommonJS vs. ES Module compatibility issue. It seemed possible that the new version of the package was a CJS module being improperly imported into our ESM-based Astro configuration (`ec.config.mjs`).

**Action:** I modified `docs/ec.config.mjs` to use a dynamic `await import(...)` for `@fujocoded/expressive-code-output`, as Astro's configuration files support top-level await.

**Result:** The local development server failed with the exact same error. This proved the issue was not with how the module was being imported.

### Attempt 2: Deeper Investigation

**Hypothesis:** The problem must be internal to the package itself.

**Action:** Using the full file path from the local error log, I inspected the contents of the problematic file: `.../node_modules/.pnpm/@fujocoded+expressive-code-output@0.1.0/node_modules/@fujocoded/expressive-code-output/dist/index.js`.

**Finding:** The bundled JavaScript file contains a compatibility shim for `require`. The error is thrown by this shim because a `require('path')` call was not correctly processed and replaced by the package's build tool. This is a build issue within the dependency itself and cannot be fixed by configuration changes in our project.

### Conclusion

The investigation confirmed a bug within the `@fujocoded/expressive-code-output@0.1.0` package. After discussing the findings, I have reverted the attempts to fix it, and will now investigate a proper solution myself.

### Update: Pinpointing the Bug

After further investigation, the precise issue was identified. The `package.json` for `@fujocoded/expressive-code-output` has its `exports` map conditions swapped.

- The `import` condition points to `./dist/index.js`, which incorrectly contains CommonJS `require()` calls.
- The `require` condition points to `./dist/index.cjs`, which is the correct CommonJS bundle.

This is a packaging bug in the dependency. When our ESM-based Astro build tries to import the package, it's served the wrong file, causing the build to fail.

### Final Resolution

After reviewing the dependency's repository and observing an unstable versioning history (`1.0.0` then `0.1.0`), the decision was made to revert to the last known stable version to ensure stability and avoid further issues. The `pnpm patch` solution was considered but ultimately rejected in favor of using a stable version.

The `@fujocoded/expressive-code-output` package has been downgraded to `0.0.1`.
