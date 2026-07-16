# Auxiliary Worker + RegisterClientReference Repro

Reproduces [redwoodjs/sdk#1259](https://github.com/redwoodjs/sdk/issues/1259).

This playground has:

- an auxiliary worker configured via `@cloudflare/vite-plugin` (`aux-worker/wrangler.jsonc`), and
- a real npm package (`sonner`) whose dist files carry `"use client"`.

On a cold dev start (`rm -rf node_modules/.vite && pnpm dev`) the auxiliary worker environment causes Vite 8’s dependency optimizer to bundle the SDK’s vendor client barrel. The barrel contains the `"use client"` module, which `directivesPlugin` rewrites to import `registerClientReference` from `rwsdk/worker`. The auxiliary environment cannot resolve that import correctly (no `react-server` condition), so the optimizer crashes with:

```
[MISSING_EXPORT] "registerClientReference" is not exported by "rwsdk/worker"
```

Removing the `auxiliaryWorkers` line from `vite.config.mts` makes the cold start succeed.

## Run

```sh
cd playground/aux-worker-registerclientreference
rm -rf node_modules/.vite
pnpm dev
```
