# React Compiler playground example

## Problem

I want a playground example that shows how to enable the React Compiler in a RedwoodSDK app.

## Context

- There is a guide at `docs/src/content/docs/guides/optimize/react-compiler.mdx` describing how to enable the compiler using Vite.
- Playground examples are self-contained projects under `playground/` and have an e2e test in `__tests__/`.

## Plan

- Copy `playground/hello-world` into a `playground/react-compiler` example.
- Add the React plugin with the compiler Babel plugin to the Vite config, before the Cloudflare and Redwood plugins.
- Update dependencies to include the React Compiler Babel plugin and `@vitejs/plugin-react`.
- Keep the e2e tests focused on basic functionality (rendering and navigation), not on direct compiler verification.


