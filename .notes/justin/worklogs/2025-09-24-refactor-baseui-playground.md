
# 2025-09-24: Refactor baseui Playground

## Problem

The `baseui` playground is overly comprehensive and its end-to-end tests use incorrect APIs (Playwright instead of Puppeteer) and do not follow established conventions. The Content Security Policy (CSP) is also missing necessary directives for images.

## Plan

1.  **Simplify the Example**: Reduce the `baseui` component showcase to a simpler example, similar in scope to the `chakra-ui` and `shadcn` playgrounds.
2.  **Update CSP Headers**: Add a `headers.ts` file to configure CSP to allow SVG images.
3.  **Refactor Tests**: Rewrite the end-to-end tests using Puppeteer APIs and adhere to the testing conventions used across the project. This includes removing the existing comprehensive and simple test files in favor of a single `e2e.test.mts`.
4.  **Cleanup**: Remove any unused files from the old implementation.
