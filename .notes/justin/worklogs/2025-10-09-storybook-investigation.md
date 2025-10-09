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

## Plan

1.  Create a new playground example based on `hello-world` to reproduce the issue.
2.  Install and configure Storybook in the new playground.
3.  Attempt to reproduce the "Maximum call stack size exceeded" error.
4.  Investigate the cause of the error within the Vite plugin.
5.  Fix the issue.
6.  Add an E2E test to the playground to prevent regressions.

I will start by creating the playground and setting up Storybook.
