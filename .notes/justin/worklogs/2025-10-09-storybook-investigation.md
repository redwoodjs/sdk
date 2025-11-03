# 2025-10-09: Storybook Support Investigation

## Problem

A user is reporting a "Maximum call stack size exceeded" error when using Storybook with our framework. The error occurs when a story is saved.

The user provided a screenshot of the stack trace. The stack trace points to an issue within our Vite plugin, specifically in `normalizeModulePath` and `isInUseClientGraph` within `miniflareHMRPlugin.mjs`. It seems there's an infinite recursion happening.

The user is using:
- `storybook@9.1.10`
- `@storybook/react@9.1.10`
- `@storybook/react-vite@9.1.10`
- `@storybook/addon-a11y@9.1.10`
- `@storybook/addon-docs@9.1.10`
- `@storybook/addon-vitest@9.1.10`

## Update (2025-10-09)

Adding the `'use client'` directive to the component did not change the behavior. The initial render is successful, but HMR changes still require a manual page refresh. The "Maximum call stack size exceeded" error was not reproduced.

The user's original stack trace points to an infinite recursion in `isInUseClientGraph` within our `miniflareHMRPlugin`. It's likely that a specific project structure, such as a circular import between components, is triggering this.

I attempted to create a circular dependency, but it resulted in a runtime "Maximum call stack size exceeded" error within the application code, not within the HMR plugin. This is not a valid reproduction of the user's issue.

The next step is to create a circular dependency at the module level that does not cause a runtime error, which should correctly test the HMR plugin's logic and reproduce the user's reported bug.

## Update (2025-10-09)

My previous attempts to create a circular dependency were flawed because they created runtime errors (either "Maximum call stack size exceeded" or "Cannot access 'A' before initialization"), preventing a proper test of the HMR plugin.

The key is to create a circular dependency at the module import level, not at the runtime call level. This will create the circular graph that the HMR plugin's `isInUseClientGraph` function has to traverse, without causing the application itself to crash.

My new plan is to have two modules that import each other, but do not call each other's functions during initialization. This structure, when imported by a client component, should finally reproduce the user's bug.

## Update (2025-10-09) - Successful Reproduction

The user provided a detailed reproduction case which has clarified the issue significantly. The problem is not a simple circular dependency, but a more complex recursive path in the module graph that is likely introduced by Storybook's architecture.

The user's setup is:
- `DesignSystem.stories.ts` imports `DesignSystem.tsx`
- `DesignSystem.tsx` imports `ColorPalettes.tsx`

The key findings are:
- Saving `ColorPalettes.tsx` (the leaf module) triggers the "Maximum call stack size exceeded" error.
- Adding `'use client'` to `ColorPalettes.tsx` **fixes the issue**, and HMR works as expected.

This confirms the original hypothesis: `isInUseClientGraph` is causing an infinite recursion. When a module is not marked `'use client'`, the function traverses its importers. With the Storybook setup, this traversal eventually leads back to a module already in the traversal path, creating a loop. Adding `'use client'` provides an early exit from the function before the loop can occur.

The plan is now to fix the bug by adding a `seen` set to `isInUseClientGraph` to track visited modules and prevent infinite recursion.

## Update (2025-10-09) - Reproduction Attempt 3

The previous reproduction attempts failed. The user mentioned the possibility of `type` imports causing a circular dependency, which is a plausible cause for the recursion in the HMR plugin.

My next attempt will be to create a `value -> type` circular dependency between the components in the playground. `DesignSystem.tsx` will continue to import the value of `ColorPalettes.tsx`, and `ColorPalettes.tsx` will be modified to import a `type` from `DesignSystem.tsx`.

This structure is common in real-world applications and is more likely to represent the user's situation and trigger the bug in `isInUseClientGraph`.

## Update (2025-10-09) - Final Fix

After a deep dive into the git history of `miniflareHMRPlugin.mts`, we confirmed that the `isInUseClientGraph` check was a legacy optimization to prevent full-page reloads, likely related to CSS changes in a pre-SSR-bridge architecture. It has always been vulnerable to infinite recursion in the presence of module graph cycles.

Given that Vite's HMR is now more robust and our architecture has matured, we have decided to remove the check entirely. The risk of keeping the fragile, bug-prone code is far greater than the risk of a few redundant HMR signals.

The `isInUseClientGraph` function and its calls have been removed. This resolves the "Maximum call stack size exceeded" error.

The next step is to verify the fix and clean up the playground.

## Update (2025-10-09) - Stale State Bugfix

Further investigation revealed a pre-existing bug in the HMR logic for the `worker` environment. The plugin was not invalidating the changed module itself, only related CSS and virtual SSR modules. This was causing a stale state issue, particularly with React instances, where the client would receive an RSC payload rendered with an old version of a server-side module.

A call to `invalidateModule(ctx.server, environment, ctx.file)` has been added to the `worker` environment's `hotUpdate` handler. This ensures that the changed module is correctly invalidated, allowing Vite to propagate the changes through the module graph and preventing the stale state issue.

With this, both the Storybook crash and the HMR stale state issue should be resolved.
## Plan

1.  Create a new playground example based on `hello-world` to reproduce the issue.
2.  Install and configure Storybook in the new playground.
3.  Attempt to reproduce the "Maximum call stack size exceeded" error.
4.  Investigate the cause of the error within the Vite plugin.
5.  Fix the issue.
6.  Add an E2E test to the playground to prevent regressions.

I will start by creating the playground and setting up Storybook.
