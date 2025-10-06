# 2025-10-06: Diagnose Renovate PR for `starter-peer-deps`

## Problem

A Renovate PR updating several dependencies in the `starter` package is failing with a TypeScript type error in `vite.config.mts`. The error points to an incompatibility between different versions of Vite/Rollup and a custom Vite plugin.

## Plan

1.  Analyze the provided TypeScript error to understand the root cause.
2.  Examine `starter/vite.config.mts` to see how the plugins are configured.
3.  Locate the source code of the custom Vite plugin (`rwsdk`).
4.  Identify the specific code in the plugin that is causing the type conflict.
5.  Formulate a hypothesis and a proposed solution without implementing it.

## Investigation

### Renovate PR Details

The PR includes the following dependency updates:

| Package                      | Change                                                                 |
| ---------------------------- | ---------------------------------------------------------------------- |
| `@cloudflare/vite-plugin`    | `1.13.3` -> `1.13.10`                                                  |
| `@cloudflare/workers-types`  | `4.20250921.0` -> `4.20251004.0`                                        |
| `react`                      | `19.2.0-canary-d415fd3e-20250919` -> `19.3.0-canary-4fdf7cf2-20251003` |
| `react-dom`                  | `19.2.0-canary-d415fd3e-20250919` -> `19.3.0-canary-4fdf7cf2-20251003` |
| `react-server-dom-webpack`   | `19.2.0-canary-d415fd3e-20250919` -> `19.3.0-canary-4fdf7cf2-20251003` |
| `vite`                       | `7.1.6` -> `7.1.9`                                                     |
| `wrangler`                   | `4.38.0` -> `4.42.0`                                                   |

### Type Error in `vite.config.mts`

The core issue is a TypeScript error in `starter/vite.config.mts` when initializing the `redwood()` plugin. The error message is extensive, but the key part points to an incompatibility in the `hotUpdate` hook signature between different versions of Rollup (a dependency of Vite).

```typescript
No overload matches this call.
  The last overload gave the following error.
    Type 'Promise<PluginOption[] | undefined>' is not assignable to type 'PluginOption'.
      Type 'Promise<PluginOption[] | undefined>' is not assignable to type 'Promise<Plugin$1<any> | FalsyPlugin | PluginOption[]>'.
        Type 'PluginOption[] | undefined' is not assignable to type 'Plugin$1<any> | FalsyPlugin | PluginOption[]>'.
          Type 'PluginOption[]' is not assignable to type 'Plugin$1<any> | FalsyPlugin | PluginOption[]'.
            Type 'import(".../vite@7.1.6/.../vite/dist/node/index").PluginOption[]' is not assignable to type 'import(".../vite@7.1.9/.../vite/dist/node/index").PluginOption[]'.
              Type 'import(".../vite@7.1.6/.../vite/dist/node/index").PluginOption' is not assignable to type 'import(".../vite@7.1.9/.../vite/dist/node/index").PluginOption'.
                Type 'Plugin$1<any>' is not assignable to type 'PluginOption'.
                  Type 'import(".../vite@7.1.6/.../vite/dist/node/index").Plugin<any>' is not assignable to type 'import(".../vite@7.1.9/.../vite/dist/node/index").Plugin<any>'.
                    Types of property 'hotUpdate' are incompatible.
                      Type 'import(".../rollup@4.50.1/.../rollup").ObjectHook<(this: import(".../rollup@4.50.1/.../rollup").MinimalPluginContext & { ...; }, ...' is not assignable to type 'import(".../rollup@4.52.4/.../rollup").ObjectHook<(this: import(".../rollup@4.52.4/.../rollup").MinimalPluginContext & { ...; }, ...'.
```

This indicates that the update from `vite@7.1.6` to `vite@7.1.9` (and its underlying Rollup dependency) has introduced a breaking change in the plugin API.

### Analysis

The `redwood()` plugin, defined in `sdk/src/vite/redwoodPlugin.mts`, aggregates several other internal plugins. The investigation pointed towards `sdk/src/vite/miniflareHMRPlugin.mts` as the source of the incompatibility, because it implements a `hotUpdate` function. The signature of this function no longer matches what the new version of Vite expects.

The problem lies within the SDK's internal plugin implementation, which is not compatible with the updated peer dependencies. Therefore, this PR cannot be merged as is.

## Next Steps

- Create a new task to update the `rwsdk` Vite plugin to be compatible with `vite@7.1.9`.
- This will involve modifying the `hotUpdate` function in `sdk/src/vite/miniflareHMRPlugin.mts` to match the new API signature.
- Once the SDK is updated and a new version is released, the Renovate PR for `starter-peer-deps` can be re-evaluated.

## Update: Attempting a fix in the SDK

Based on the analysis, the next logical step was to see if the type error could be reproduced within the `sdk` package itself.

1.  **Updated `vite` dev dependency:** In `sdk/package.json`, the `vite` version in `devDependencies` was updated from a pinned `7.1.6` to `^7.1.9` to match the version in the failing PR. The thinking was that this should surface the same type incompatibility during the SDK's own build process.
2.  **Ran `pnpm install` and `pnpm build`:** After updating the dependency, I ran the install and build commands for the SDK.
3.  **Observation:** Unexpectedly, no TypeScript error occurred. The SDK package builds successfully, even with the updated `vite` version that is causing issues in the `starter` project.

This is suspicious. The type error should theoretically appear in any environment where the incompatible plugin signature is checked against the updated Vite/Rollup types. The fact that it doesn't suggests that the SDK's internal build process might not be performing the same type-checking as when the plugin is consumed downstream in the `starter` project.

## Debugging Strategy: Minimal Reproduction

To effectively debug this, we need to reproduce the type error within the `sdk` package's development environment. The plan is to create a temporary file that simulates the conditions of the `starter` project's `vite.config.mts`.

1.  **Create a temporary test file:** I'll create a new file, `sdk/src/vite/temp-debug-vite-config.mts`, right next to the `miniflareHMRPlugin.mts`.
2.  **Simulate `defineConfig`:** This file will import `defineConfig` from `vite` and the `miniflareHMRPlugin` from the local file.
3.  **Isolate the plugin:** The `defineConfig` call will be configured with *only* the `miniflareHMRPlugin`. This should trigger the same TypeScript error we're seeing in the `starter` project, but in a much more controlled environment.
4.  This will allow for direct debugging and iteration on the plugin's code until the type incompatibility is resolved.

## Resolution: Mismatched Dev Dependency

The root cause of the issue has been identified. It was not a bug in the plugin code itself, but a dependency resolution conflict caused by a pinned version in the SDK's `package.json`.

1.  **The Conflict:** The `sdk` package had a `devDependency` on a pinned version of `vite`, specifically `7.1.6`. The Renovate PR updated the `starter` project's `devDependency` to `vite@7.1.9`.
2.  **Resolution Problem:** When `pnpm` installed dependencies for the `starter` project, it saw two different version requirements for `vite`. It provided `vite@7.1.9` to the `starter` project, but the imported `rwsdk` was linked to its own dependency, `vite@7.1.6`.
3.  **The Type Error:** This resulted in the TypeScript compiler seeing two different definitions for the same Vite types (e.g., `Plugin`, `HotUpdateOptions`). The types from `vite@7.1.6` were not assignable to the types from `vite@7.1.9`, causing the build to fail.
4.  **The Fix:** The solution was to change the `vite` `devDependency` in `sdk/package.json` from the pinned `7.1.6` to a compatible version range, `~7.1.9`. This allows `pnpm` to resolve a single, shared version of `vite` (`7.1.9`) for both the `sdk` and the `starter` project, eliminating the type conflict.

With this change, the `starter` project should now build successfully.
