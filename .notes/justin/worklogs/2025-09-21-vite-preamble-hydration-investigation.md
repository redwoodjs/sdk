# Work Log: 2025-09-21 - Vite Preamble Hydration Investigation

## 1. Problem Definition: E2E Test Failures for Client Components

Following the successful resolution of the `useId` mismatch, a new issue was discovered during end-to-end (E2E) testing of the `useid-test` playground.

While the playground functions perfectly when run manually with `pnpm dev`, the E2E tests consistently fail for any page that includes a client component.

### Observations

-   **Test Scope:** All tests involving client components (`client-only` page, `mixed` server/client page) fail. Tests for server-only pages pass without issue.
-   **Manual vs. E2E:** The application hydrates and runs correctly when operated manually in a browser. The failure is confined to the automated test environment run via Vitest.
-   **Primary Error:** The browser console during a failed test shows a Vite-specific error: `Error: @vitejs/plugin-react can't detect preamble. Something is wrong.` This indicates a failure in the client-side JavaScript bundling and hydration process.
-   **DOM State:** In failing tests, the application's HTML content is not rendered into the DOM. The `div#hydrate-root` remains empty, even after waiting for an extended period. The RSC payload is present in a `<script>` tag, but the client-side hydration process that should render it into the DOM does not complete successfully.
-   **`NODE_ENV` Discovery:** Manually setting `NODE_ENV=development` on the command line when running the E2E tests changes the failure mode. The preamble error disappears, but a new, more conventional hydration mismatch error occurs (`expected '_S_1_' to match /^_R_\w+_$/`). This strongly suggests that the `NODE_ENV` is not being set as expected within the test harness, which is the root cause of the preamble error.

### Investigation Goals

The investigation is now focused on the E2E test harness and its environment, rather than the framework's runtime code.

1.  Determine why `process.env.NODE_ENV` is not being set to `development` for dev server tests within the E2E harness, contrary to Vite's default behavior.
2.  Implement a fix within the test harness to correctly set `NODE_ENV` to `development` for dev tests and `production` for deployment tests.
3.  Verify that this fix resolves the preamble error and allows all client component tests to pass.
