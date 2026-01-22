# RedwoodSDK Integration Testing Showcase (Test Bridge)

This project demonstrates the **Test-Bridge Pattern** for integration testing in RedwoodSDK applications using `vitest-pool-workers`.

## Overview

Because RedwoodSDK apps run in a Cloudflare Worker environment with specific context (AsyncLocalStorage, DB/KV bindings), we cannot simply "import" backend code into a test file and run it. We must run it inside the Worker environment.

This showcase uses a "Bridge" pattern:
1.  **Tests run in the Worker Pool** (managed by Vitest).
2.  **Tests invoke actions** by sending a local HTTP request (Loopback) to a `/_test` endpoint in the worker.
3.  **The Worker executes the action** with full context (Router, Storage, Bindings) and returns the result.

## Setup

1.  **Install Dependencies**:
    ```shell
    npm install
    ```

2.  **Build the Worker**:
    The tests run against the *built* worker script to ensure correct RSC transformation and environment handling.
    ```shell
    npm run build
    ```

3.  **Run Tests**:
    ```shell
    npm test
    ```

## Key Components

*   **`src/worker.tsx`**: Defines the `/_test` route and exposes actions via `handleTestRequest`.
*   **`src/lib/test-bridge.ts`**: The server-side handler for test requests.
*   **`src/tests/helpers.ts`**: The client-side `invoke` helper used in tests.
*   **`vitest.config.ts`**: Configures `vitest-pool-workers` to use the built `wrangler.json`.

## Limitations

*   **Requires Build**: You must run `npm run build` before running tests if you change backend code.
*   **No Internal Mocking**: You cannot use `vi.mock()` to mock internal application modules, as the worker runs as a "Black Box". You must rely on integration-level behavior.
