# 2025-09-25 - Directive HMR Playground

## Problem

The current test suite does not cover Hot Module Replacement (HMR) behavior for `use client` and `use server` directives. When a developer adds or removes these directives, the dev server should update the module graph and reload the affected components without a full page refresh. This functionality is not verified.

## Plan

1.  Create a `directive-hmr` playground example by scaffolding from `hello-world`.
2.  Develop an end-to-end test to validate HMR for `use client` directives:
    -   **Adding `use client`**: Start with a server component, add the directive, and confirm it becomes interactive.
    -   **Removing `use client`**: Start with a client component, remove the directive, and confirm it becomes a server component.
3.  Develop a separate test for `use server` directives:
    -   **Adding a server action**: Start with a component without a server action, then import and use one, verifying it works post-HMR.
    -   **Removing a server action**: Start with a component using a server action, then remove it and confirm the action is no longer triggered.
4.  The tests will run in dev mode only, as HMR is a development feature. They will use file system operations to modify component source code and `poll` utilities to wait for the UI to reflect changes.
