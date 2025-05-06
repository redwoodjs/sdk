# RedwoodJS Starter Smoke Testing

This document explains the smoke testing process for RedwoodJS starter templates.

## Overview

The smoke tests verify that the starter templates work correctly by:

1. Starting a development server
2. Testing the server and client health checks
3. Upgrading to realtime mode and testing again
4. Capturing screenshots as artifacts

## Running Smoke Tests Locally

To run the smoke tests for all starters:

```sh
# From the monorepo root
./scripts/smoke-test-starters.sh
```

This will:

- Test the minimal starter with the root path `/`
- Test the standard starter with the path `/user/login`

## How It Works

The smoke testing process:

1. Uses the SDK's smoke-test script for each starter template
2. Copies each starter to a temporary directory with a unique name
3. Starts a development server for each starter
4. Performs health checks using Puppeteer and Chrome
5. Attempts to upgrade to realtime mode and verifies it works
6. Saves screenshots as artifacts for debugging

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
pnpm smoke-test "/custom/path" -p="../starters/minimal" --artifact-dir="./my-artifacts"
```

## Troubleshooting

If a smoke test fails:

1. Check the logs for error messages
2. Examine the screenshot artifacts to see what the browser was displaying
3. Try running the tests locally
