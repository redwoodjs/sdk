## Problem

We currently lack end-to-end tests for our CSS and directive handling, which makes it difficult to verify that different import and usage strategies work correctly in both development (with HMR) and production environments.

## Plan

1.  Create a new playground example (`css-e2e`) specifically for testing CSS-related functionality.
2.  Implement three separate pages, each demonstrating a different CSS import strategy (`?url` import, CSS Modules, and side-effect import).
3.  Create another playground (`directive-hmr`) to test HMR for `use client` and `use server` directives.
4.  Write end-to-end tests to verify that styles and directives are correctly handled in both development and production builds.
5.  Write HMR-specific tests to ensure that style and directive changes are correctly applied without a full page reload in the development environment.
6.  Update the test harness to pass the `projectDir` to test functions, simplifying file modifications in tests.
7.  Refactor all new tests to follow the established e2e testing conventions.
---

### PR Description

This change adds end-to-end test suites for CSS and directive handling.

Two new playground examples are introduced:
-   `css-e2e`: Tests three CSS import strategies (`?url` imports, CSS Modules, and side-effect imports).
-   `directive-hmr`: Tests HMR behavior for the `use client` and `use server` directives.

The tests check for correct initial rendering and HMR updates in development, and correct rendering in production. The test harness was also updated to provide the `projectDir` to test functions, simplifying file manipulations within the tests.
