# RedwoodSDK Monorepo — Architectural Overview

## 2000ft View

RedwoodSDK is a server-first React framework targeting Cloudflare Workers (workerd). It is published as the `rwsdk` npm package and provides a Vite-based toolchain that enables React Server Components, Server Functions, and a type-safe router. Developers define routes in a `worker.tsx` entry file; the framework handles SSR, client hydration, and action dispatching end-to-end. The repository is a pnpm monorepo containing the SDK itself, a bare-bones starter template, a docs site, community extensions, optional add-ons, and an extensive playground of feature-verification projects.

## System Flow

1. **Development / Build Entry** — The consumer project (e.g. `starter/` or a playground example) imports `redwoodPlugin` from `rwsdk/vite` and adds it to their `vite.config.ts`. The plugin is defined in `sdk/src/vite/redwoodPlugin.mts` and composes ~30 sub-plugins that handle directives scanning, SSR bridging, client/server transforms, HMR, Prisma integration, and Cloudflare Workers dev environment setup.
2. **App Definition** — The consumer writes `src/worker.tsx`, calling `defineApp()` (exported from `sdk/src/runtime/worker.tsx`). `defineApp` accepts a tree of routes created with `route()` and `render()` from `rwsdk/router`.
3. **Request Handling** — At runtime inside the Worker, the request hits the `fetch` handler returned by `defineApp`. The handler strips the Vite base path, serves static assets via the `ASSETS` service binding, then routes the request through the router (`sdk/src/runtime/lib/router.ts`).
4. **Rendering** — For matched routes, the framework may render React Server Components (`renderToRscStream`), perform SSR (`renderDocumentHtmlStream`), or handle server actions (`createRscActionHandler`). The result is stitched into an HTML stream and returned as a `Response`.
5. **Client Side** — The client entry hydrates the RSC payload and sets up client-side navigation. `use-synced-state` provides realtime state synchronization between worker and client.

## Directory Map

- `sdk/` — Core SDK package (`rwsdk`). Contains Vite plugins (`sdk/src/vite/`), runtime worker/router/render code (`sdk/src/runtime/`), testing utilities (`sdk/src/lib/`), LLM rules (`sdk/src/llms/`), dev scripts (`sdk/src/scripts/`), and the `use-synced-state` module.
- `starter/` — Bare-bones starter template used by `create-rwsdk`. Consumes `rwsdk` via workspace link.
- `playground/` — Official feature-verification examples. Each sub-directory is a mini project. CI runs E2E tests against these.
- `community/` — Community extensions and utilities, published as `rwsdk-community`.
- `community/playground/` — Demo/showcase projects; not run in CI.
- `docs/` — Documentation site (Fumadocs-based), also a RedwoodSDK app.
- `addons/` — Optional add-ons (e.g. `passkey`).
- `examples/` — Additional examples (minimal).
- `scripts/` — Monorepo-level shell scripts (E2E orchestration, release helpers).

## Key Abstractions

**`defineApp`** — The primary runtime entry point in `sdk/src/runtime/worker.tsx`. It takes a route tree and returns an object with a `fetch` method that serves as the Cloudflare Worker entrypoint. It wires together routing, RSC action handling, asset serving, and SSR.

**`route` / `render`** — Core router primitives from `sdk/src/runtime/lib/router.ts`. `route(path, handler)` maps a URL path to a handler; `render(Document, children)` sets up a document shell layout. The router supports middleware, method-based handlers, exception handlers, and nested layouts.

**`redwoodPlugin`** — The main Vite plugin (`sdk/src/vite/redwoodPlugin.mts`) that orchestrates the build pipeline. It combines plugins for directive scanning, client component transformation, server function transformation, SSR bridge generation, Miniflare HMR, Prisma client handling, and Cloudflare integration. This is where most framework magic lives.

**Directives (`"use server"`, `"use client"`)** — The SDK transforms modules bearing these directives during the build. Server functions become RPC endpoints; client components are split into separate client bundles. The directive pipeline is implemented across `directivesPlugin.mts`, `transformServerFunctions.mts`, `transformClientComponents.mts`, and related scanners.

**`RequestInfo`** — A request-scoped context object (`sdk/src/runtime/requestInfo/`) that carries parsed request data, route params, and user-defined context through the handler chain.

**`rwsync`** — A CLI tool (`sdk/bin/rwsync`) that rebuilds the SDK and syncs it into an external project, with optional watch mode. Inside the monorepo it is largely superseded by pnpm workspace links, but it remains the official bridge for out-of-tree development.

## Conventions Observed

- **pnpm workspace monorepo** — All internal packages reference each other via `"workspace:*"`.
- **Tests co-located with source** — Unit and integration tests live next to the files they test as `*.test.ts` or `*.test.mts`. Vitest is the test runner.
- **`.mts` for Vite-side code, `.ts` for runtime** — Files under `sdk/src/vite/` use `.mts`; files under `sdk/src/runtime/` use `.ts`.
- **`worker.tsx` as app entry** — Every consumer project defines its application in `src/worker.tsx` exporting a `default defineApp(...)` call.
- **E2E coverage required for SDK core** — Changes to SDK core or official playground examples must include E2E tests. Community playground demos are exempt.
- **`pnpm.overrides` for security** — The root `package.json` uses `pnpm.overrides` to force specific versions of transitive dependencies.
- **Node >=24.14.0, pnpm >=10.31.0** — Enforced via `engines` and `packageManager` fields.

## Known Unknowns

- **Full CI pipeline** — GitHub Actions workflows exist under `.github/workflows/` but their exact matrix and triggers were not inspected.
- **Realtime/Durable Objects internals** — `sdk/src/runtime/lib/realtime/` and `sdk/src/use-synced-state/` contain DO-based realtime code; the full protocol and deployment model were not reviewed in depth.
- **Auth module** — `sdk/src/runtime/lib/auth/` exists but its API surface and integration patterns were not examined.
- **Addon build/publish flow** — How `addons/passkey/` (and future add-ons) are versioned, built, and published is unclear.
- **Docs search indexing** — The docs site uses Orama for search; how indexes are generated at build time was not investigated.
- **Release automation** — `sdk/scripts/release.sh` and `scripts/unrelease.mjs` exist but their mechanics were not read.