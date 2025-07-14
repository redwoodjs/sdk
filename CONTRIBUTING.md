# Contributing

This document provides instructions for contributing to the SDK.

## Getting Started

1.  Make sure you have [Node.js](https://nodejs.org) (>=22) installed.
2.  This project uses [pnpm](https://pnpm.io) as a package manager, which is managed using [Corepack](https://nodejs.org/api/corepack.html). Enable Corepack by running:
    ```sh
    corepack enable
    ```
3.  Install dependencies from the root of the `sdk` directory:

```sh
pnpm install
```

## Building

To build the `rwsdk` package, run the following command from the root of the `sdk` directory:

```sh
pnpm --filter rwsdk build
```

## Testing

To run the test suite for the `rwsdk` package, run this command from the root of the `sdk` directory:

```sh
pnpm --filter rwsdk test
```

## Smoke Testing

For details on how to run smoke tests, please see the [smoke testing documentation](./SMOKE-TESTING.md).

## Formatting

This project uses Prettier for code formatting. To format the code, run:

```sh
pnpm format
```

## Debugging changes to the sdk locally for a project

The `rwsync` command provides a bridge between a local checkout of the `rwsdk` and a project that uses it, enabling a fast and efficient development workflow.

First, set the `RWSDK_REPO` environment variable in your shell's configuration file (e.g., `~/.bashrc`, `~/.zshrc`) to point to the absolute path of your local `sdk` repository checkout.

```sh
# e.g. in ~/.zshrc
export RWSDK_REPO=/path/to/your/local/sdk
```

## Debugging the Vite Plugin

The RedwoodSDK Vite plugin is composed of several smaller, internal plugins. To debug them, you can use the [debug](https://www.npmjs.com/package/debug) package by setting the `DEBUG` environment variable.

Each internal plugin has a unique namespace, like `rwsdk:vite:hmr-plugin`. To enable logging for a specific plugin, set the `DEBUG` variable to its namespace.

For example, to see debug output from just the HMR plugin:
```sh
DEBUG='rwsdk:vite:hmr-plugin'
```

You can also use a wildcard to enable logging for all internal Vite plugins:
```sh
DEBUG='rwsdk:vite:*'
```

For more detailed "verbose" output, set the `VERBOSE` environment variable to `1`.

Here is a full example command that enables verbose logging for the HMR plugin, starts `rwsync` in watch mode to sync your local SDK changes with a test project, and redirects all output to a log file for analysis:
```sh
VERBOSE=1 DEBUG='rwsdk:vite:hmr-plugin' npx rwsync --watch "npm run dev" 2>&1 | tee /tmp/out.log
```