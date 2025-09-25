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

This change adds end-to-end test suites for CSS handling and directive Hot Module Replacement (HMR).

#### CSS Handling Tests

A new `css-e2e` playground is introduced to test three CSS import strategies:
*   **Document-level Stylesheet**: A stylesheet linked in `Document.tsx` via a `?url` import.
*   **CSS Modules**: A `.module.css` file imported into a 'use client' component.
*   **Side-effect CSS Import**: A standard `.css` file imported for its side effects in a 'use client' component.

The tests confirm that styles are correctly applied on initial render in both development and production environments. They also verify that HMR updates styles in development when the corresponding CSS files are modified.

#### Directive HMR Tests

A new `directive-hmr` playground is added to test HMR behavior for `use client` and `use server` directives.

*   **`use client` Directive**:
    *   Tests adding the directive to a Server Component, confirming it becomes interactive (hydrates) and that subsequent markup changes are applied via HMR.
    *   Tests removing the directive from a Client Component, confirming it reverts to a non-interactive Server Component and that subsequent markup changes are applied via HMR.

*   **`use server` Directive**:
    *   The test starts with a working server action and confirms it executes correctly.
    *   It then removes the `"use server"` directive from the action file and verifies that an error occurs on the client.
    *   Finally, it re-adds the directive, modifies the action's logic to return a new value, and confirms that HMR correctly updates the behavior on the client.

#### Test Harness Update

The test harness helpers (`testDev` and `testDevAndDeploy`) have been updated to pass the temporary `projectDir` to test functions. This simplifies file modification logic within HMR tests by removing the need for `getPlaygroundEnvironment()`.
