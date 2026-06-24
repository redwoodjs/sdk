# JSON Import Reproduction

This playground reproduces the crash that happens when a JSON file is imported from a module that ends up in both the client and server bundles.

## Setup

```shell
pnpm install
pnpm dev
```

## What it tests

- `src/app/data/sample.json` is imported by both:
  - `src/app/pages/Home.tsx` (server component)
  - `src/app/components/JsonBadge.tsx` ("use client" component)

This causes the JSON file to be pulled into both the worker/SSR bundle and the client bundle, which previously crashed the dev server.
