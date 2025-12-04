# Testing Cloudflare Vite Plugin Env Regression (1.15.2)

## Problem

Report that Cloudflare Vite plugin version 1.15.2 introduces a regression with using Cloudflare Env. Need to confirm if this is the case.

## Plan

1. Test basic env access in hello-world playground example
2. Test env binding access (HYPERDRIVE) in a real project
3. Compare behavior between versions 1.15.1, 1.15.2, and 1.15.3
4. Investigate CI failures if they occur

## Context

- Env is imported as: `import { env } from "cloudflare:workers"`
- Should be accessible in React Server Components
- Bindings like HYPERDRIVE should be accessible via `env.HYPERDRIVE`
- Version 1.15.2 added `cloudflare:node` to built-in modules (commit 49eada3)

## Test Results

### Hello-World Playground Example

**Setup**:
- Added `TEST_ENV_VAR` to wrangler.jsonc vars
- Updated Home component to import env and render the value
- Added console.log to verify env access in server logs
- Tested with versions 1.15.2 and 1.15.3

**Results**:
- ✓ Version 1.15.2: Env access works correctly
  - `env.TEST_ENV_VAR` returns expected value
  - Console log shows env value
  - HTML renders env value correctly
  - No errors in dev server logs

- ✓ Version 1.15.3: Env access works correctly
  - Same behavior as 1.15.2

**Conclusion**: Basic env access works correctly in both versions 1.15.2 and 1.15.3 in the hello-world playground example.

### Real Project Testing (HYPERDRIVE Binding)

**Setup**:
- Tested in a project using HYPERDRIVE binding
- Function accesses `env.HYPERDRIVE` to create database connections
- Tested with versions 1.15.1 and 1.15.2

**Version 1.15.1**:
- ✓ `env.HYPERDRIVE` exists and is accessible
- ✓ Console output shows Hyperdrive object with expected properties (host, port, user, password, connectionString)
- ✓ Database connection can be created successfully

**Version 1.15.2**:
- ✓ `env.HYPERDRIVE` exists and is accessible in local dev
- ✓ Console output shows Hyperdrive object with expected properties
- ✓ Database connection can be created successfully

**CI Testing**:
- CI tests failed after upgrade to 1.15.2
- Authentication tests failing - expected redirect after login, but getting redirected back to login page
- **Important note**: Login wasn't working in 1.15.1 either (likely for a different reason), so the CI failure in 1.15.2 may be unrelated to the env access regression being investigated
- CI uses dev server (`vite dev --mode ci`), not preview server

**Next Steps**:
- Investigate getting login working before the upgrade to establish a baseline
- This will help determine if the CI failures are related to the plugin upgrade or a pre-existing issue

## Investigation Notes

**Version 1.15.2 Changes**:
- Added `cloudflare:node` to built-in modules (commit 49eada3)
- This change only adds `cloudflare:node` to the `cloudflareBuiltInModules` array - it shouldn't affect `cloudflare:workers` resolution
- `.dev.vars` loading appears unchanged - the plugin still uses `unstable_getVarsForDev` from wrangler to load vars
- The plugin uses `unstable_getMiniflareWorkerOptions` which calls `getBindings` which calls `getVarsForDev` - this path seems intact
- Built-in modules are configured via `resolve.builtins: [...cloudflareBuiltInModules]` in the environment options
- `cloudflare:node` and `cloudflare:workers` are both in the same array, so there shouldn't be a conflict

## Conclusion

Both versions 1.15.1 and 1.15.2 work correctly for accessing env bindings in local development:
- Importing `env` from `cloudflare:workers`
- Accessing bindings like `env.HYPERDRIVE`
- Using bindings to create database connections

The reported regression does not appear to affect env access in local development scenarios. The CI authentication test failures in 1.15.2 appear to be unrelated to the env access regression being investigated, as login wasn't working in 1.15.1 either (likely for a different reason).

**Next investigation**: Get login working before the upgrade to establish a baseline and determine if CI failures are related to the plugin upgrade or a pre-existing issue.
