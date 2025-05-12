# RedwoodJS Starter Smoke Testing

This document explains the smoke testing process for RedwoodJS starter templates.

## Overview

The smoke tests verify that the starter templates work correctly by:

1. Starting a development server
2. Testing the server and client health checks
3. Testing that client action calls can cause server component rerenders
4. Upgrading to realtime mode and testing again
5. Capturing screenshots as artifacts

## Running Smoke Tests Locally

To run the smoke tests for all starters:

```sh
# From the monorepo root
./scripts/smoke-test-starters.sh
```

This will:

- Test the minimal starter with the root path `/`
- Test the standard starter with the path `/user/login`

For testing your own project, you can use:

```sh
# From within your project directory
npx rw-scripts smoke-tests
```

## How It Works

The smoke testing process:

1. Uses the SDK's smoke-test script for each starter template
2. Copies each starter to a temporary directory with a unique name
3. Starts a development server for each starter
4. Performs health checks using Puppeteer and Chrome
5. Tests client-to-server communication and server component rerenders
6. Attempts to upgrade to realtime mode and verifies it works
7. Saves screenshots as artifacts for debugging

## Test Specifics

The smoke tests verify several critical aspects of the application:

1. **Server Component Rendering**: Verifies that server components render correctly
2. **Client Component Rendering**: Verifies that client components render correctly
3. **Client-to-Server Communication**: Verifies that client actions can successfully communicate with the server
4. **Server Component Rerendering**: Verifies that client action calls can cause server components to rerender with updated data
5. **Realtime Functionality**: Verifies that the app functions correctly after being upgraded to realtime mode

## CI Integration

The smoke tests run automatically in GitHub Actions when:

- Code is pushed to the main branch
- A pull request is opened
- The workflow is manually triggered

Screenshots are stored as GitHub artifacts for 7 days.

## Running Individual Tests

To run a smoke test for a specific starter:

```sh
# From the sdk/ directory
pnpm smoke-test --url="/custom/path" --path="../starters/minimal" --artifact-dir="./my-artifacts"

# Skip client-side tests (only run server-side checks)
pnpm smoke-test --skip-client
```

## Troubleshooting

If a smoke test fails:

1. Check the logs for error messages
2. Examine the screenshot artifacts to see what the browser was displaying
3. Try running the tests locally
