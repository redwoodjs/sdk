# 2025-09-22: RSC Playground Example

## Problem

The project needs a clear, self-contained example of how to use React Server Components (RSC) features within the RedwoodSDK framework. This example should serve as both a demonstration for users and a test case for the framework's capabilities.

## Plan

1.  **Create a new playground example:**
    *   Duplicate the `playground/hello-world` directory to `playground/rsc-kitchen-sink`.
    *   Update `package.json` and other configuration files for the new example.
2.  **Implement core RSC features:**
    *   **Server Component:** Create a main page that renders on the server and displays initial data.
    *   **Client Component:** Create an interactive component (`"use client"`) that is rendered by the server component.
    *   **Server Actions:**
        *   Implement a server action triggered by a form submission (`<form action={...}>`).
        *   Implement a server action triggered by a button's `onClick` handler.
3.  **Develop End-to-End Tests:**
    *   Write tests in `__tests__/e2e.test.mts` to validate the functionality.
    *   The tests will use Playwright to interact with the running application and verify:
        *   Correct rendering of server and client components.
        *   Successful execution and state updates from both types of server actions.

## PR Description

### feat: Add RSC kitchen sink playground example

This change introduces a new playground example, `rsc-kitchen-sink`, to demonstrate the framework's React Server Components (RSC) capabilities. The example includes a server component that renders a client component, which in turn executes two types of server actions: a form action and an `onClick` action.

End-to-end tests are included to validate the functionality of each component and action, ensuring the example serves as a reliable demonstration and test case.
