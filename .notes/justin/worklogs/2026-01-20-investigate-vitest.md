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
