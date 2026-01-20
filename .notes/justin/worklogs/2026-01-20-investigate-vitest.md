# 2026-01-20 Investigate Vitest Support

## Initialized investigation into Vitest support

RedwoodSDK currently lacks native support for Vitest, specifically regarding RSC awareness ('react-server' conditions) and integration with the Cloudflare Vitest plugin.
Users are encountering errors like `Error: RedwoodSDK: 'react-server' import condition needs to be used in this environment` when trying to use `vitest-pool-workers`.

### Gathered context
- **Goal**: Make Vitest RSC aware (use client/server understanding, CF vitest plugin compat).
- **Current State**: Users advised to use Playwright/Cypress against `pnpm dev`.
- **User Reports**:
    - `aoifelee`: Error `rwsdk: 'react-server' import condition needs to be used`.
    - `grace charles`: Needs integration tests for auth/middleware/handlers without full browser.
    - `jont`: Suggested `vitest-plugin-rsc` (Storybook team) + `vitest-pool-workers`. Reported success with `vitest-plugin-rsc` on built worker.
    - `peterp`: Suggests `vitest-plugin-rsc` + `msw` for mocking.

## Assessed current state and defined plan

The existing `playground/vitest` exists but is currently a clone of `hello-world`. It is set up for E2E tests (`e2e.test.mts` using `rwsdk/e2e`), NOT for Vitest unit/integration tests with `vitest-pool-workers`. `package.json` in the repro does not have `@cloudflare/vitest-pool-workers` yet.

To reproduce the reported error ("'react-server' import condition needs to be used"), we need to configure Vitest to run *inside* the worker context using the pool.

### Defined Strategy
- **Goal**: Achieve *native* RedwoodSDK support without requiring users to install third-party plugins like `vitest-plugin-rsc`.
- **Constraints**:
  - Users inheriting `vitest-pool-workers` is acceptable.
  - `vitest-plugin-rsc` is considered a Plan B that is **out of the scope of this investigation** if native support proves unfeasible in the short term.

### Next Steps
1.  [x] **Reproduction Setup**:
    - [x] Add `@cloudflare/vitest-pool-workers` and `vitest` to `playground/vitest/package.json`.
    - [x] Create `playground/vitest/vitest.config.mts` configured to use the pool.
    - [x] Add a test case (e.g. `__tests__/worker.test.tsx`) that imports `rwsdk` (or uses `defineApp`) and tries to run.
2.  [x] **Verify Failure**:
    - Run the test and confirm the `react-server` condition error.
3.  **Investigate & Implement Native Support**:
    - Investigate why the `react-server` condition is missing in the pool environment.
    - Explore providing a custom environment or configuration within `rwsdk` to inject the condition.
    - Attempt to solve this within the SDK's existing tooling/hooks.

## Achieved reproduction in playground/vitest

To get the reproduction working with `vitest-pool-workers`, the following adjustments were necessary:
- **Rename**: Renamed `vitest-repro` to `vitest`.
- **Downgrade**: Reverted Vitest to `3.2.4` and `@cloudflare/vitest-pool-workers` to `0.12.5` to match Cloudflare documentation constraints (must be <= 3.2.x).
- **Types**: Added `@cloudflare/vitest-pool-workers` to `tsconfig.json` types to avoid resolution errors in the test environment.
- **Wrangler Config**: Fixed `wrangler.jsonc` by adding `directory: "public"` to the `assets` configuration, which is required when the `assets` key is present.

The test now runs (`pnpm test` in the playground) and correctly reproduces the target error:
`Error: RedwoodSDK: 'react-server' import condition needs to be used in this environment`


## Investigated Vitest SSR vs RSC environment handling

I've investigated why simply adding `resolve.conditions` failed and what this implies for our architecture.

### Findings

1.  **Vitest runs in "SSR" mode by default**: When running tests, Vitest (and `vitest-pool-workers`) treats the environment as "SSR" (Server-Side Rendering).
2.  **Vite Config Resolution**: Vite's config resolution logic prioritizes `ssr.resolve.conditions` over top-level `resolve.conditions` when `ssr: true` (which is the case for Vitest). This explains why my initial `resolve.conditions` change did nothing. Adding it to `ssr.resolve.conditions` worked because that's where Vitest explicitly looks.
3.  **Conflict with RSC Architecture**: This "SSR" default conflicts with our Hybrid RSC/SSR Architecture:
    -   **Our `worker` environment**: Is configured for **RSC**. It explicitly includes `"react-server"`. It is the *primary* environment where user code (and tests) usually runs.
    -   **Our `ssr` environment**: Is configured for **SSR**. It explicitly *excludes* `"react-server"` and uses standard React DOM server builds.
    -   **The Problem**: Vitest forces us into a generic "SSR" bucket. By adding `"react-server"` to Vitest's `ssr.resolve`, we are effectively forcing Vitest's "SSR" environment to act like our "RSC" environment.

### The `optimizeDeps` conflict

Once we force the "SSR" environment to act like RSC (by adding conditions), Vite's `optimizeDeps` kicks in for `rwsdk` imports.
-   The SDK's worker code imports platform specifics like `cloudflare:workers` and `async_hooks`.
-   Our `worker` environment config (in `configPlugin.mts`) carefully handles these using `optimizeDeps.exclude` or `noExternal`.
-   Vitest's default `optimizeDeps` config does *not* have these exclusions.
-   This leads to the build errors we saw: `Could not resolve "cloudflare:workers"`.

### Conclusion

We cannot simply "patch" Vitest's SSR config. We need Vitest to run in an environment that mirrors our `worker` (RSC) environment, NOT our `ssr` environment. The `ssr` environment is strictly for the *second phase* of our rendering pipeline (hydrating the RSC payload to HTML), whereas unit tests for Worker components (like `defineApp`) fundamentally belong in the RSC domain.

We need to investigate if we can tell Vitest to use the `worker` environment config directly, or if we must manually align Vitest's `test` config to match our `worker` config (react-server conditions, externalizing platform modules, etc).

## Analyzed race condition and GitHub issues

I have identified the root cause of the "config was not set" error: the `@cloudflare/vite-plugin` has a race condition with Vitest initialization.

### Race Condition Analysis

1.  **Early Execution**: The `@cloudflare/vite-plugin` eagerly executes worker code during its `configureServer` hook.
2.  **Call Chain**: `configureServer` -> `getCurrentWorkerNameToExportTypesMap` -> `fetchWorkerExportTypes`.
3.  **Trigger**: `fetchWorkerExportTypes` invokes `miniflare.dispatchFetch`, causing the worker environment to spin up and execute entry points *before* Vitest has finished initializing its global configuration.
4.  **Result**: If the worker code (or its imports) attempts to access Vitest globals (like `vitest.config`), it crashes with "The config was not set".

### GitHub Issue Context (#9381)

User provided context from `workers-sdk` issue #9381, which confirms:
-   Full integration between `vitest-pool-workers` and `@cloudflare/vite-plugin` is a known gap and a "big chunk of work" (Cloudflare team).
-   Current workarounds involve separate build steps or overriding asset paths.
-   RedwoodSDK relies on the Cloudflare plugin, so simply removing it is not a viable option.

### Next Steps

Since we cannot remove the plugin, we must mitigate the race condition while keeping the plugin active. I will investigate delaying the plugin initialization or making the SDK robust against this early execution.


## Analyzed Ecosystem State and Decided to Hold Off

### Findings
- **Incompatibility**: `vitest-pool-workers` and `@cloudflare/vite-plugin` are currently incompatible when used together due to an early request/race condition in the plugin's `configureServer` hook. This forces worker execution before Vitest is ready.
- **Version Support**: `vitest-pool-workers` only supports Vitest 2.x-3.2.x. Vitest 4+ is not supported yet (see https://github.com/cloudflare/workers-sdk/issues/9381).
- **Imminent Overhaul**: A major PR is in progress (https://github.com/cloudflare/workers-sdk/pull/11632) to support Vitest 4 and overhaul the architecture, potentially removing the reliance on the "SSR" environment assumption.
- **SSR Assumption**: Current `vitest-pool-workers` implementation heavily assumes an SSR environment (see `packages/vitest-pool-workers/src/config/index.ts`), which conflicts with our `worker` (RSC) environment needs. This is expected to change in the overhaul.

### Decision
Given the "flux" state of the Cloudflare testing ecosystem and the imminent major changes, we have decided to **hold off** on implementing native `vite-plugin-cloudflare` + `vitest-pool-workers` integration to avoid wasted effort on workarounds that will soon be obsolete.

We will wait for the `workers-sdk` overhaul to land.


## Investigation Summary & Decision: Hold Off on Native Vitest Support

### Investigation Narrative & Decision

Our goal was to enable native Vitest support for RedwoodSDK, specifically targeting the `worker` environment to support our RSC architecture (which relies on the `react-server` condition).

**Attempt 1: Basic Configuration**
We started by setting up a basic `vitest-pool-workers` configuration in `playground/vitest`. This immediately failed with the error:
> `Error: RedwoodSDK: 'react-server' import condition needs to be used in this environment`

**Attempt 2: Patching SSR Environment**
We initially attempted to patch this by forcing `resolve.conditions: ["react-server"]` into Vitest's default `ssr` environment. However, this proved to be a mistake: forcing RSC conditions into an SSR environment caused conflicts with platform built-ins. Specifically, use of `server-only` imports prevented the test runner from resolving `cloudflare:workers`, as the default `optimizeDeps` config didn't correctly externalize them, leading to:
> `Could not resolve "cloudflare:workers"`

**Attempt 3: Using Cloudflare Vite Plugin**
Recognizing that the `ssr` environment was the wrong target, we shifted our strategy to use the `worker` environment directly, mirroring how RedwoodSDK normally operates. We attempted to use the `@cloudflare/vite-plugin` and `redwood` plugin in vitest config. This exposed a **critical race condition**.

The `@cloudflare/vite-plugin` is "eager". In its `configureServer` hook, it calls `getCurrentWorkerNameToExportTypesMap`, which triggers `miniflare.dispatchFetch`. This executes the worker code *before* Vitest has finished initializing its global configuration. Any access to Vitest globals (like `vitest.config`) during this early execution crashes the runner with:
> `Error: The config was not set`

**Ecosystem Status & Blocker**
We found that the `@cloudflare/vite-plugin` (which RedwoodSDK relies on) is currently incompatible with `vitest-pool-workers` due to this early execution issue. Furthermore, the `workers-sdk` ecosystem is in a state of flux:
*   `vitest-pool-workers` code (e.g., `src/config/index.ts`) benchmarks heavily on hardcoded `ssr` environment assumptions, which fights against our need for a `worker` entry environment.
*   A major overhaul is in progress (PR #11632) to support Vitest 4+ and re-architect environment handling.

**Decision: Hold Off**
We have decided to **hold off** on implementing native support. The workarounds required to make the current versions work would be fragile and high-maintenance. Given the imminent architecture changes in `workers-sdk`, investing in these workarounds would likely be wasted effort. We will wait for the overhaul to land before revisiting this.


