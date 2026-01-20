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

The existing `playground/vitest-repro` exists but is currently a clone of `hello-world`. It is set up for E2E tests (`e2e.test.mts` using `rwsdk/e2e`), NOT for Vitest unit/integration tests with `vitest-pool-workers`. `package.json` in the repro does not have `@cloudflare/vitest-pool-workers` yet.

To reproduce the reported error ("'react-server' import condition needs to be used"), we need to configure Vitest to run *inside* the worker context using the pool.

### Defined Strategy
- **Goal**: Achieve *native* RedwoodSDK support without requiring users to install third-party plugins like `vitest-plugin-rsc`.
- **Constraint**: Users inheriting `vitest-pool-workers` is acceptable.
- **Fallback**: `vitest-plugin-rsc` is considered **Plan B** if native support proves unfeasible in the short term.

### Next Steps
1.  **Reproduction Setup**:
    - Add `@cloudflare/vitest-pool-workers` and `vitest` to `playground/vitest-repro/package.json`.
    - Create `playground/vitest-repro/vitest.config.mts` configured to use the pool.
    - Add a test case (e.g. `__tests__/worker.test.tsx`) that imports `rwsdk` (or uses `defineApp`) and tries to run.
2.  **Verify Failure**:
    - Run the test and confirm the `react-server` condition error.
3.  **Investigate & Implement Native Support (Plan A)**:
    - Investigate why the `react-server` condition is missing in the pool environment.
    - Explore providing a custom environment or configuration within `rwsdk` to inject the condition.
    - Attempt to solve this within the SDK's existing tooling/hooks.
4.  **Fallback (Plan B)**:
    - If native support is blocked, investigate `vitest-plugin-rsc` as a stopgap.
    - Document the setup for users.
