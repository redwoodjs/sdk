# Issue #1259 — Auxiliary worker + node_modules "use client" crashes cold dev start

## Problem

In dev, when a RedwoodSDK app combines:

1. an auxiliary worker configured via `@cloudflare/vite-plugin` (`auxiliaryWorkers`), and
2. any `node_modules` dependency whose dist files carry `"use client"`,

the Vite 8 / Rolldown dependency optimizer crashes on a cold start with:

```
[MISSING_EXPORT] "registerClientReference" is not exported by "rwsdk/worker"
```

The SDK only knows about three Vite environments (`client`, `ssr`, `worker`), but the Cloudflare plugin creates an additional environment for each auxiliary worker. The SDK's directive/barrel plugins were applying their setup to **every** environment, so the auxiliary worker's optimizer tried to bundle the vendor client barrel, got a rewritten `import { registerClientReference } from "rwsdk/worker"`, and could not resolve it because the auxiliary environment lacks the `react-server` condition.

## Reproduction

Created `playground/aux-worker-registerclientreference`.

- `vite.config.mts` registers an auxiliary worker (`aux-worker/wrangler.jsonc`).
- `src/app/pages/Home.tsx` imports `Toaster` from `sonner`, a real npm package with `"use client"` in its dist.
- `@cloudflare/vite-plugin` 1.42.3, `vite` 8.1.0, `wrangler` 4.105.0.

### Before the fix

`rm -rf node_modules/.vite && pnpm dev` crashes with the `MISSING_EXPORT registerClientReference` error.

Removing the `auxiliaryWorkers` line lets the cold start succeed.

### After the fix

The dev server boots cleanly and the page renders.

## Implementation

Scoped the SDK's RSC-specific dev setup to only the environments it owns.

### Files changed

- `sdk/src/vite/constants.mts`
  - Added `SDK_ENVIRONMENT_NAMES = ["client", "ssr", "worker"]`.

- `sdk/src/vite/directiveModulesDevPlugin.mts`
  - In `configResolved`, only call `configureOptimizeDeps` for environments in `SDK_ENVIRONMENT_NAMES`.
  - Auxiliary worker environments no longer get the vendor client/server barrels injected as `optimizeDeps` entries.

- `sdk/src/vite/directivesPlugin.mts`
  - In `configEnvironment`, bail out early for environments not in `SDK_ENVIRONMENT_NAMES`.
  - Auxiliary worker environments no longer get the `rsc-directives-transform` optimizer plugin, so their copies of `node_modules` `"use client"` files are not rewritten to import `registerClientReference`.

### Tests

- `sdk/src/vite/directiveModulesDevPlugin.test.mts`
  - Added `configResolved` test verifying barrels are injected into `client`/`ssr`/`worker` but not `aux_email_worker`.

- `sdk/src/vite/directivesPlugin.test.mts`
  - Added `configEnvironment` tests verifying the directive transform optimizer plugin is registered for `client`/`ssr`/`worker` but skipped for auxiliary/custom environments.

## Verification

- `pnpm vitest --run src/vite/` passes (223 tests).
- `cd playground/aux-worker-registerclientreference && rm -rf node_modules/.vite && pnpm dev` boots successfully after the fix.
- `RWSDK_SKIP_DEPLOY=1 pnpm test:e2e -- playground/aux-worker-registerclientreference/__tests__/e2e.test.mts` passes (dev test; deploy test skipped locally).

## Documentation

- `docs/architecture/directiveTransforms.md` — added a note that directive transforms are scoped to SDK environments and auxiliary workers are left untouched.
- `docs/architecture/devServerDependencyOptimization.md` — added a note that barrel files are only injected into SDK environments.
