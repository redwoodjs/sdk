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

## To debug changes to the sdk locally for a project

The `rwsync` command provides a bridge between a local checkout of the `rwsdk` and a project that uses it, enabling a fast and efficient development workflow.

First, set the `RWSDK_REPO` environment variable in your shell's configuration file (e.g., `~/.bashrc`, `~/.zshrc`) to point to the absolute path of your local `sdk` repository checkout.

```sh
# e.g. in ~/.zshrc
export RWSDK_REPO=/path/to/your/local/sdk
```

### One-time Sync

To perform a one-time synchronization of your local SDK changes to your project, run the following command from your project's root directory:

```sh
rwsync
```

This will build the SDK, copy the relevant files into your project's `node_modules`, and then you can start your development server.

```sh
rwsync && pnpm dev
```

### Watch Mode

For continuous development, you can use the watch mode. This will automatically sync changes from the SDK to your project whenever you save a file. You can also provide a command that will be automatically restarted after each sync.

```sh
# This will watch for changes, and cancel + re-run `pnpm dev` after each sync
rwsync --watch "npm run dev"
```

---

## Under the hood

### `rwsync`

The `rwsync` script is used for testing out changes to a local checkout of the sdk repo to a RedwoodSDK project.

#### Slow Sync (Full Install)

A "slow sync" is performed whenever there is a change to the SDK's `package.json` file. This is the most robust method and ensures that any changes to dependencies (`dependencies`, `peerDependencies`, etc.) are correctly installed in your project.

It works by:
1. Running `pnpm build` in the SDK directory.
2. Using `npm pack` to create a `.tgz` tarball of the SDK package.
3. Installing this tarball in the target project using its native package manager (`npm`, `pnpm`, or `yarn`).
4. Restoring the project's `package.json` and lockfile to their original state to avoid committing temporary changes.

#### Fast Sync (File Copying)

If only the code in the SDK has changed (but not its `package.json`), `rwsync` performs a "fast sync". This is much quicker and avoids the overhead of a full package installation.

It works by:
1. Running `pnpm build` in the SDK directory.
2. Reading the `files` array from the SDK's `package.json`.
3. Copying each file and directory listed in the `files` array directly into the project's `node_modules/rwsdk` directory.