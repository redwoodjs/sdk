# Optimize Deps Exclude Directives

This playground reproduces the issue described in
[redwoodjs/sdk#1250](https://github.com/redwoodjs/sdk/issues/1250).

## The problem

In dev, RedwoodSDK routes every `"use client"` file found in `node_modules`
through a pre-bundled **vendor barrel**. That barrel is processed by Vite's
**dependency optimizer** (esbuild/Rolldown), which does not run the host
application's normal Vite plugins.

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

This simulates a compiled CSS-in-JS library where the component source does not
statically import any CSS; the host's build-time transform emits the CSS import
when the module loads.

## Configuration

The config opts the raw-source package out of Vite's dependency optimizer:

```ts
optimizeDeps: {
  exclude: ["my-ui-lib"];
}
```

RedwoodSDK now honors this by moving the package's directive files out of the
pre-bundled vendor barrel and into the **app barrel**, which flows through the
host's normal Vite plugin pipeline.

## Steps to reproduce

```bash
cd playground/optimize-deps-exclude-directives
pnpm dev
```

Open the browser at the URL shown in the terminal.

### Expected behavior after the fix

- The terminal shows `[host-transform] Running host transform for .../my-ui-lib/src/button.tsx`.
- The browser console shows the client-side marker.
- The button has a red background (injected client-side by Vite during hydration).

### CSS note

In dev, the red background is injected client-side by Vite when the component
hydrates, so it will not appear in the SSR HTML. In production, the CSS chunk is
included in the build manifest and emitted as a `<link rel="stylesheet">` tag by
RedwoodSDK's `Stylesheets` component.

## Build verification

```bash
pnpm build
```

Check that `dist/client/assets/` contains a CSS chunk for the button and that
`dist/client/.vite/manifest.json` lists it under `packages/my-ui-lib/src/button.tsx`.
