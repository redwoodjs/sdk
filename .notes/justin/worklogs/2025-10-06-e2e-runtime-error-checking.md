### PR Description

This change introduces automatic client-side error checking to the end-to-end test harness. Previously, tests would only fail based on their explicit assertions, potentially missing uncaught JavaScript errors that could indicate a broken user experience.

The test harness now monitors for page errors (including console errors and uncaught exceptions) during test execution. If any such errors are detected, the test will fail, providing immediate feedback on runtime issues.

A new option, `checkForPageErrors`, has been added to the test runners (`testDev`, `testDeploy`, `testDevAndDeploy`). This allows specific tests to opt-out of this behavior if client-side errors are expected. By default, error checking is enabled.

### Testing

The following test outcomes confirm the changes work as expected:

*   Tests that intentionally cause a client-side error now fail as expected.
*   Tests that opt-out of error checking by setting `checkForPageErrors: false` pass, even if a client-side error occurs.

### CI Failure Analysis

Based on the provided CI logs, here is a detailed breakdown of the observed failures. The issues are multi-faceted, involving both deployment and development server environments.

#### 1. Deployment: Client-Side Asset Loading Failures

This is the most critical issue, affecting multiple playground examples in their deployed state. The browser is unable to fetch essential JavaScript assets from the deployed Cloudflare worker. This is a runtime failure, not a test timeout.

*   **Playground**: `useid-test`
    *   **Test Module**: `playground/useid-test/__tests__/e2e.test.mts`
    *   **Failing Test**: `mixed page maintains server IDs and hydrates client IDs consistently (deployment)`
    *   **Error Details**:
        ```
        Error: Test "..." failed with page errors:

        Console errors:
        - TypeError: Failed to fetch dynamically imported module: https://useid-test-test-generous-swan-7547d4ef.redwoodjs.workers.dev/assets/client-BHKiEoWm.js
        - Failed to load resource: net::ERR_ABORTED
        ```

*   **Playground**: `baseui`
    *   **Test Module**: `playground/baseui/__tests__/e2e.test.mts`
    *   **Failing Tests**:
        1.  `renders Base UI playground without errors (deployment)`
        2.  `interactive components work correctly (deployment)`
    *   **Error Details (Test 1)**:
        ```
        Console errors:
        - TypeError: Failed to fetch dynamically imported module: https://baseui-test-chosen-tahr-12efd472.redwoodjs.workers.dev/assets/client-BHKiEoWm.js
        - Failed to load resource: net::ERR_ABORTED
        ```
    *   **Error Details (Test 2)**:
        ```
        Console errors:
        - TypeError: Failed to fetch dynamically imported module: https://baseui-test-chosen-tahr-12efd472.redwoodjs.workers.dev/assets/index-C15rTbc3.js
        - Failed to load resource: net::ERR_ABORTED
        ```

#### 2. Dev Server: Dependency Optimization Failure

*   **Playground**: `database-do`
    *   **Test Module**: `playground/database-do/__tests__/e2e.test.mts`
    *   **Failing Test**: `allows adding and completing todos (dev)`
    *   **Error Details**: The Vite dev server responded with a `504` status code for a pre-bundled dependency.
        ```
        Console errors:
        - Failed to load resource: the server responded with a status of 504 (Outdated Optimize Dep)
        - Failed to load resource: net::ERR_ABORTED
        ```
    *   **Analysis**: This points to a problem with Vite's dependency pre-bundling and serving mechanism within the dev server for this specific playground. The initial dev server startup for this test also timed out on its first attempt, suggesting general instability.

#### 3. Deployment: Interactive `wrangler` Prompt

*   **Affected Playgrounds**: `client-navigation`, `database-do`, `useid-test`, `rsc-kitchen-sink`, `baseui`, `non-blocking-suspense`, `render-apis`, `shadcn`.
*   **Log Evidence**:
    ```
    Do you want to proceed with deployment? (y/N):
    ```
*   **Analysis**: The `wrangler deploy` command, executed via `npm run release`, is an interactive prompt in the CI environment. While the specific failures above are due to asset loading, this prompt will cause any test that doesn't fail faster to time out. This is a high-priority issue to fix for CI stability.

#### 4. Test Harness: Unhandled Promise Rejections

*   **Affected Playgrounds**: `shadcn`, `chakra-ui` (and likely others)
*   **Error Details**:
    ```
    [vitest] Unhandled Rejection
    TargetCloseError: Protocol error (DOM.resolveNode): Target closed
    ```
*   **Analysis**: This error occurs after tests have completed, during the teardown phase. It suggests a race condition in the test harness where Puppeteer is attempting to perform an action on a page or element after the browser target has already been closed. While not causing a direct test failure, it indicates instability in the harness's cleanup logic.

### Investigation: Non-Interactive Deployment

The interactive `wrangler deploy` prompt is the most immediate blocker for CI stability. The investigation into a non-interactive solution involved several steps:

1.  **Command-Line Flags**: I checked the command-line help for `wrangler deploy` by running `pnpm exec wrangler deploy --help`. No `--yes`, `--force`, or other non-interactive flags were listed in the output.

2.  **Web Searches**: Multiple web searches for "wrangler deploy non-interactive" (and variations) did not yield official documentation for a non-interactive flag or a CI-specific environment variable. The results were mostly unhelpful AI-generated articles.

3.  **Attempted Solution (Reverted)**: My first attempt was to modify the `release` script in all playground `package.json` files to use a standard shell workaround, piping `yes` into the command: `yes | wrangler deploy`. This approach was reverted, indicating it is not the correct way to solve this problem within this project.

The next step is to investigate the test harness code that *calls* the `release` script, specifically the `$expect` utility in `sdk/src/lib/e2e/release.mts`, as that seems to be the intended mechanism for handling interactive prompts.
