
# Mantine Playground Example

## Problem

The project needs a playground example for the Mantine UI library to demonstrate its integration with the RedwoodSDK framework. This serves as a reference for users and allows for end-to-end testing of the integration.

## Plan

1.  Create a new `mantine` playground by copying the `hello-world` example.
2.  Use the `baseui` playground as a reference for integrating a CSS-in-JS library.
3.  Install Mantine dependencies (`@mantine/core`, `@mantine/hooks`, postcss plugins).
4.  Configure `Document.tsx` with Mantine's `ColorSchemeScript` and `MantineProvider`.
5.  Replace the content of `Home.tsx` with a few sample Mantine components.
6.  Update the end-to-end test to verify the Mantine components render correctly.
7.  Update configuration files (`package.json`, `wrangler.jsonc`, etc.) with the new playground's information.
8.  Install dependencies and run tests to ensure everything works as expected.

## Refinement (2025-10-22)

Following a review, I've identified a better way to integrate Mantine's provider and styles, using the framework's layout API.

1.  Create a `MantineLayout.tsx` component to wrap routes with `MantineProvider`.
2.  Update `Document.tsx` to use a `?url` import for Mantine's stylesheet, which is better for production builds.
3.  Refactor `worker.tsx` to apply `MantineLayout` using the `layout()` router function.
4.  Re-run end-to-end tests to confirm the refactored implementation is correct.
