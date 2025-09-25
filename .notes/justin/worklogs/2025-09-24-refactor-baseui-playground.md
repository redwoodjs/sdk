
# 2025-09-24: Refactor baseui Playground

## Problem

The `baseui` playground is overly comprehensive and its end-to-end tests use incorrect APIs (Playwright instead of Puppeteer) and do not follow established conventions. The Content Security Policy (CSP) is also missing necessary directives for images. The component styling and structure does not follow the patterns from the Base UI documentation.

## Plan

1.  **Simplify the Example**: Reduce the `baseui` component showcase to a simpler example, similar in scope to the `chakra-ui` and `shadcn` playgrounds.
2.  **Update CSP Headers**: Add a `headers.ts` file to configure CSP to allow SVG images.
3.  **Refactor Tests**: Rewrite the end-to-end tests using Puppeteer APIs and adhere to the testing conventions used across the project. This includes removing the existing comprehensive and simple test files in favor of a single `e2e.test.mts`.
4.  **Componentize and Style**:
    *   Create individual components for `Accordion`, `Dialog`, and `Switch` (`ExampleAccordion`, `ExampleDialog`, `ExampleSwitch`).
    *   Each component will have its own CSS module for styling, as per the provided examples.
    *   Each component file will include the `"use client";` directive.
    *   Update the `Home` page to render these new components.
5.  **Cleanup**: Remove any unused files from the old implementation, such as `ClientShowcase.tsx`.
6.  **Update Tests**: Adjust the end-to-end tests to match the new component structure and styling.

---

## PR Description

This PR introduces a new playground example for Base UI to demonstrate its integration with RedwoodSDK.

The primary goals of this example are to:
- Showcase support for a popular headless component library.
- Serve as a reference for users on structuring an application with both server-rendered content and interactive client components.
- Expand end-to-end test coverage to ensure compatibility with Base UI's styling and hydration patterns, particularly with CSS Modules.

The playground includes styled examples of `Accordion`, `Dialog`, and `Switch` components.
