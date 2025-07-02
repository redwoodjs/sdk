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

## Formatting

This project uses Prettier for code formatting. To format the code, run:

```sh
pnpm format
```

## To debug changes to the sdk locally for a project

Run this following in the project's root directory:

```sh
RWSDK_REPO=/path/to/sdk/repo npx rwsync && npm run dev
```