# RedwoodSDK Smoke Testing

## Overview

The smoke tests checks that the critical paths of the sdk work for a project.

- It runs the whole flow: from install, to dev, to release.
- For both dev and production, it checks that {server,client} components render, that client components get action results, and that server components re-render as a result of client-initiated actions.
- It then upgrades to realtime and does these same checks again (for both dev in production).
- For dev, we also check that HMR works for server and client components.

## Running Smoke Tests Locally

To run smoke tests for a project:

```sh
pnpm smoke-test / --path=<path_to_project> --sync --keep
```

Or if you do not have a checkout of the sdk

```sh
# From within your project directory
npx rw-scripts smoke-tests
```

## How It Works

The smoke testing process:

1. Uses the SDK's smoke-test script for each starter template
2. Copies each starter to a temporary directory with a unique name
3. Starts a development server
4. Performs health checks using Puppeteer and Chrome
5. Attempts to upgrade to realtime mode and perform checks again
6. Runs `npm run release`
7. Runs the same checks, now for production
8. Saves screenshots as artifacts for debugging

## CI Integration

The smoke tests run automatically in GitHub Actions when:

- Code is pushed to the main branch
- A pull request is opened (for non-forks, for security reasons)
- The workflow is manually triggered

Screenshots are stored as GitHub artifacts for 7 days.

## Troubleshooting

If a smoke test fails:

1. Check the logs for error messages (you can also find the logs as a file in the artifacts dir)
2. Examine the screenshot artifacts to see what the browser was displaying
3. Try running the tests locally
4. You'll also find a copy of the project used for smoke tests in the artifacts dir. You can try running dev/release using this project manually

You can find the artifacts in `.artifacts` for the directory you ran the smoke test command in.
