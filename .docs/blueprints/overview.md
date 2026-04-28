# RedwoodSDK Monorepo Overview

## 2000ft View

RedwoodSDK (rwsdk) is a server-first React framework that targets Cloudflare Workers (workerd). It provides Vite-based tooling for React Server Components (RSC), Server Functions, type-safe routing, middleware, and realtime primitives. Developers install it via `rwsdk` on npm and scaffold projects with `create-rwsdk`. The monorepo contains the core SDK, a starter template, a documentation site, community extensions, playground test apps, and optional addons. Everything is built and deployed on the Cloudflare edge runtime.

## System Flow

The typical request path through a RedwoodSDK application:

1. **Vite Dev / Build**: The developer runs `vite dev` (or `vite build`). The Redwood Vite plugin (`sdk/src/vite/redwoodPlugin.mts`) orchestrates the build. It wraps `@cloudflare/vite-plugin`, `@vitejs/plugin-react`, and numerous custom plugins for directive scanning, SSR bridging, script discovery, and asset handling.

2. **Worker Entry**: The application defines a worker entry at `src/worker.tsx` (configurable). It exports the result of `defineApp(routes)` from `rwsdk/worker`.

3. **Request Handling**: The worker's `fetch` handler receives the request. `defineApp` (in `sdk/src/runtime/worker.tsx`) creates a router and RSC action handler. It strips the Vite base path, serves static assets via the `ASSETS` service binding, then dispatches to the router.

4. **Routing**: The router (`sdk/src/runtime/lib/router.ts`) evaluates routes sequentially in a flattened, short-circuiting loop. Matches trigger middleware, layout components, page components, or raw Response handlers. The same path handles full page loads, RSC actions, and API requests.

5. **Rendering**: For page routes, the framework renders the matched component tree as an RSC stream (`renderToRscStream`). If SSR is enabled, the RSC stream is stitched with a document shell stream (`stitchDocumentAndAppStreams`) to produce HTML. Client-side scripts are discovered and preloaded.

6. **Client Hydration**: The browser receives HTML with inline scripts that load the client entry (`src/client.tsx`). The client entry initializes client-side navigation (`initClientNavigation`), which uses RSC RPC to fetch subsequent pages without full reloads.

## Directory Map

- `sdk/` — Core SDK package (`rwsdk` on npm). Contains the Vite plugin, runtime framework code, CLI scripts (`rw-scripts`, `rwsync`), and unit tests.
- `starter/` — Bare-bones project template used by `create-rwsdk`. Shows canonical `worker.tsx`, `client.tsx`, and `app/` layout.
- `docs/` — Documentation site (Fumadocs-based), also a RedwoodSDK app. Includes architecture decision records under `docs/architecture/`.
- `community/` — Community extensions and utilities (`rwsdk-community`). Exposes `worker`, `client`, and `test` entry points.
- `playground/` — Official SDK test projects. Each subdirectory exercises a specific feature. Must include E2E tests. CI runs these.
- `community/playground/` — Showcase/demo projects. Not required to have E2E tests. Excluded from CI.
- `addons/` — Optional installable addons (e.g., `addons/passkey/`).
- `examples/` — Additional example projects.
- `scripts/` — Monorepo-level scripts (e.g., E2E test runner, release helpers, cleanup).
- `.github/workflows/` — CI/CD workflows: E2E tests, smoke tests, releases, code quality, community CI.

### Inside `sdk/src/`

- `vite/` — Vite plugin implementation and build-time logic (directive transforms, SSR bridge, dependency resolution, HMR, production build orchestration).
- `runtime/` — Framework runtime that executes inside the worker. Contains request handling, routing, rendering, client-side navigation, and server-function registration.
- `runtime/entries/` — Public API entry points (`worker`, `client`, `router`, `auth`, etc.).
- `runtime/lib/` — Core runtime libraries: router, link helpers, auth, db helpers, realtime, turnstile.
- `runtime/render/` — Stream rendering: RSC, SSR, document stitching, preloads, stylesheets.
- `runtime/client/` — Browser-side client initialization and navigation.
- `runtime/register/` — Server-function registration and method enforcement.
- `lib/` — Build-time utilities (path normalization, JSON utils, wrangler config discovery, smoke-test infrastructure, E2E setup).
- `scripts/` — CLI scripts: `dev-init`, `ensure-deploy-env`, `smoke-test`, `debug-sync`, `worker-run`, `migrate-new`.
- `use-synced-state/` — Realtime shared-state sync between clients via Durable Object.
- `llms/` — LLM context/rules export.

## Key Abstractions

**defineApp** — The application bootstrap function exported from `rwsdk/worker`. It accepts a route array and options, then returns an object with a `fetch` handler and route metadata. This is what the Cloudflare Worker runtime invokes for every request.

**Router** — A sequential, short-circuiting route matcher defined in `sdk/src/runtime/lib/router.ts`. Routes are flattened at initialization. `route()`, `prefix()`, `layout()`, and `render()` are the primary APIs for defining routes. The router handles both page components and raw `Response` objects.

**RSC / SSR Hybrid Rendering** — The framework runs two rendering pipelines: React Server Components produce a streaming payload, and a document shell produces HTML. `stitchDocumentAndAppStreams` combines them Suspense-aware. The SSR Bridge (`ssrBridgePlugin`) resolves conflicting dependency requirements between the RSC and SSR Vite environments.

**Directives** — `"use client"` and `"use server"` directives are discovered via an `esbuild`-based scanner (`runDirectivesScan.mts`) and transformed by Vite plugins. `"use server"` modules become RPC proxies; `"use client"` modules are handled differently for RSC and SSR bundles.

**Server Functions** — Functions marked with `"use server"` are wrapped at build time. At runtime, `registerServerFunctionWrap` allows global interception (e.g., for observability). The action handler in `worker.tsx` deserializes calls, invokes the function, and normalizes results back into the RSC stream.

**Client Navigation** — `initClientNavigation` in `sdk/src/runtime/client/navigation.ts` provides SPA-like navigation by fetching RSC payloads over the network and updating the DOM. It maintains a navigation cache and integrates with browser history.

## Conventions Observed

- **pnpm workspace monorepo**: Managed with `pnpm-workspace.yaml`. Root `package.json` defines shared dev dependencies and scripts. SDK uses `tsc --build` for compilation.
- **Co-located tests**: Unit tests live next to source files as `*.test.ts` or `*.test.mts`. Vitest is the test runner.
- **Playground E2E tests**: Playground apps include `__tests__/e2e.test.mts` files. E2E tests use a concurrent, suite-level approach with Puppeteer.
- **TypeScript throughout**: All source is TypeScript. SDK compiles to `dist/` with `.mjs` / `.d.mts` outputs. Runtime code uses `.ts` / `.tsx`.
- **Entry conventions**: Apps use `src/worker.tsx` for the worker entry and `src/client.tsx` for the client entry. These are configurable but assumed by default.
- **Vite plugin composition**: The Redwood plugin is a collection of many small Vite plugins rather than one large plugin. Each handles a specific concern (directives, HMR, SSR bridge, Prisma, etc.).
- **Context comments**: Codebase uses `context(author, date):` and `todo(author, date):` annotations inline.
- **Workspace linking for dev**: `starter/` and `playground/` projects reference `rwsdk` via `workspace:*`. `rwsync` is provided for external project development with watch mode.

## Known Unknowns

- The exact release versioning and changelog process is partially documented in `docs/architecture/releaseProcess.md`, but the automation details (e.g., how `scripts/unrelease.mjs` and `sdk/scripts/release.sh` interact) were not fully explored.
- The community package (`rwsdk-community`) has a Durable Object (`durableObject.ts`) and test entry points, but its full surface area and how it differs from core SDK features is not deeply mapped.
- Addon packaging and distribution mechanics are unclear beyond the single `passkey` addon present.
- The `llms/` export and `vibe-rules` dependency suggest some LLM-context generation pipeline, but its build and update process was not investigated.
- Cloudflare-specific bindings and configuration (wrangler.toml patterns across playground apps) were not systematically reviewed.