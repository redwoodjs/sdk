# Vendor Barrel Source Repro

This playground reproduces the issue described in
[redwoodjs/sdk#1250](https://github.com/redwoodjs/sdk/issues/1250).

## The problem

In dev, RedwoodSDK routes every `"use client"` file found in `node_modules`
through a pre-bundled **vendor barrel**. That barrel is processed by Vite's
**dependency optimizer** (esbuild), which does not run the host application's
normal Vite plugins.

A meta-framework or component library that ships raw ESM source and relies on
the host's Vite transforms therefore breaks in dev: the transform never runs.

## What this repro shows

The `my-ui-lib` package (symlinked into `node_modules/my-ui-lib`) exports a
single client component, `MyButton`, from `src/button.tsx`.

The host `vite.config.mts` defines a small Vite plugin that should run on every
`my-ui-lib` module:

1. It injects a `console.log("[host-transform] ...")` marker.
2. It injects `import "./button.css"`, which styles the button with a **red
   background**.

## Steps to reproduce

```bash
cd playground/vendor-barrel-source-repro
pnpm install
pnpm dev
```

Open the browser at the URL shown in the terminal.

### Expected buggy behavior

- The button is rendered with the browser's default button styling (no red
  background).
- The browser console does **not** contain a log starting with
  `[host-transform] CLIENT-SIDE MARKER`.
- The terminal does **not** show `[host-transform] Running host transform for
  ...node_modules/my-ui-lib...`.

This proves the host's Vite `transform` hook never ran for the `my-ui-lib`
component because RedwoodSDK pulled it out of the vendor barrel instead.

### Expected behavior after the fix

When `forceSourcePaths` (or an equivalent mechanism) is implemented and
`my-ui-lib` is opted out of the vendor barrel:

- The terminal shows the host transform running for the file.
- The browser console shows the client-side marker.
- The button has a red background.
