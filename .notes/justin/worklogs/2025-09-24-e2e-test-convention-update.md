# 2025-09-24 - E2E Test Convention Update

## Problem

The current end-to-end tests in the `playground/` directory are not following a consistent and reliable pattern. This can lead to flaky tests and make them difficult to maintain. A new set of conventions, including waiting for client-side hydration before interaction, needs to be applied to all e2e tests.

## Plan

1.  **Create `waitForHydration` utility**: Implement the `waitForHydration` function. This function will wait for a signal from the client-side that the application has been fully hydrated. I'll have it wait for a `data-hydrated="true"` attribute on the `<body>` tag.
2.  **Update Client Entrypoint**: Modify the client entrypoint to set the `data-hydrated="true"` attribute on the body after hydration is complete.
3.  **Refactor E2E Tests**: Go through each e2e test file in `playground/` and update them to use the new conventions, including `waitForHydration` before any page interactions, and using `poll` for assertions.

I'll start by implementing `waitForHydration` and then move on to updating the tests.
