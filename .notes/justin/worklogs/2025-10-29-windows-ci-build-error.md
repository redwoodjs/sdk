# Worklog (2025-10-29): Windows CI Build Failures

## Executive Summary

The primary goal is to diagnose and fix a persistent `Rollup failed to resolve import` error that occurs during `pnpm build` on the Windows CI runner. This error seems to be related to Vite's tsconfig path alias resolution, specifically with the `vite-tsconfig-paths` plugin. The build succeeds when run manually in an interactive CI session within the temporary test directory but fails when executed as part of the automated E2E test suite. This suggests an environmental or contextual discrepancy.

## Investigation: `Rollup failed to resolve import`

The E2E tests for `hello-world` and `database-do` are failing on Windows with the following error:

```
[vite:resolve] Rollup failed to resolve import "@/app/components/__SmokeTest" from "src/worker.tsx".
file: D:/a/sdk/sdk/playground/hello-world-test-charmed-wombat-2a220268/src/worker.tsx
```

The key observations are:
- The error only occurs on Windows runners in the automated CI environment.
- Manually running `pnpm build` in the temporary directory (e.g., `hello-world-test-charmed-wombat-2a220268`) created by the CI process succeeds without errors.
- The error originates from the `vite-tsconfig-paths` plugin, which is responsible for resolving aliases defined in `tsconfig.json`.

This points to a subtle difference in how the plugin operates when invoked from our E2E test harness (`execa`) versus an interactive shell. The most likely culprits are differences in the current working directory, path normalization (e.g., handling of `/` vs `\`), or environment variables.

### Next Steps

To diagnose this, the immediate next step is to add instrumentation to the `vite-tsconfig-paths` plugin within the E2E test environment. By logging the inputs and outputs of its path resolution logic, we can pinpoint why the alias resolution is failing. I will modify the E2E test setup to temporarily patch the plugin's code with `console.log` statements before the build is executed.

## Update: The CI vs. Interactive Shell Discrepancy

A key insight is that the build succeeds when run manually in an interactive CI session (via `windows-debug.yml`) but fails in the automated `playground-e2e-tests.yml` workflow.

Upon reviewing the workflow files, a critical difference was identified:
- The failing `playground-e2e-tests.yml` workflow was forcing all key steps to run with `shell: bash` on Windows runners.
- The working interactive `windows-debug.yml` workflow uses the default Windows shell, PowerShell (`pwsh`).

This shell difference was the root cause of the path resolution errors. The `bash` environment on Windows (provided by Git) handles paths differently than native shells, causing issues when Node.js scripts spawned child processes for the build.

The fix was to modify `playground-e2e-tests.yml` to conditionally use `pwsh` on Windows runners, aligning the CI environment with the working interactive environment.
