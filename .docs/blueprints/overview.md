# RedwoodSDK Monorepo — Architectural Overview

## 2000ft View

RedwoodSDK (rwsdk) is a server-first React framework that targets Cloudflare Workers (workerd). It is distributed as an npm package (`rwsdk`) and a project-scaffolding CLI (`create-rwsdk`). The framework provides React Server Components, Server Functions, a type-safe standards-based router, middleware, and realtime primitives, all wired together through a custom Vite plugin. Users write a `worker.tsx` entry point, define routes with `defineApp`, and deploy to Cloudflare. This repository is the monorepo that contains the SDK source, a starter template, documentation site, playground test projects, community extensions, and addon packages.

## System Flow

1. **Dev / Build Entry** — The user runs `vite dev` or `vite build`. Vite loads the Redwood plugin (`sdk/src/vite/redwoodPlugin.mts`), which composes many smaller internal plugins.
2. **Directive Scan** — On startup, an `esbuild`-based scanner traverses the dependency graph from the worker entry to discover every `"use client"` and `"use server"` directive (`sdk/src/vite/runDirectivesScan.mts`).
3. **Plugin Pipeline** — During development, plugins handle HMR via Miniflare (`miniflareHMRPlugin`), module resolution for directives (`directiveModulesDevPlugin`), SSR bridge wiring (`ssrBridgePlugin`), and asset transformation. In production, the build proceeds through a five-phase orchestrated process: initial scan, first worker pass (for tree-shaking and discovery), SSR build, client build, and a second linker worker pass that stitches artifacts together and resolves asset placeholders using the manifest.
4. **Request Handling** — At runtime, the Cloudflare Worker executes the bundled `worker.js`. Incoming requests hit the request handler in `sdk/src/runtime/worker.tsx`, which runs middleware, then RSC actions, then page routes in a short-circuiting loop. RSC rendering streams server components; SSR rendering produces HTML that is stitched with the RSC stream.
5. **Client Hydration** — The browser receives HTML with inline script imports for early hydration, loads the client entry, and hydrates the React tree. Client-side navigation is handled by the router’s client-side counterpart.

## Directory Map

- `sdk/` — Core `rwsdk` package. Contains the Vite plugin, runtime request handling, router, e2e harness, and build tooling. Built with `tsc`.
- `sdk/src/vite/` — Dozens of Vite plugins that compose the Redwood build pipeline (dev server, directives, transforms, linker, SSR bridge, etc.).
- `sdk/src/runtime/` — Worker runtime code: request handler, renderer, router, auth, db helpers, realtime primitives, and client entries.
- `sdk/src/lib/` — Shared utilities: e2e test setup, smoke tests, JSON helpers, path normalization, wrangler config discovery.
- `starter/` — Bare-bones template project used by `create-rwsdk`. Consumes `rwsdk` as a workspace dependency.
- `docs/` — User-facing documentation site, itself a RedwoodSDK app. Uses fumadocs for content and Orama for search.
- `playground/` — Official SDK test projects. Each is a self-contained RedwoodSDK app with E2E tests in `__tests__`. Used for CI and feature validation.
- `community/` — Community-contributed package (`rwsdk-community`) and its own playground demos. Independent release cycle.
- `addons/` — Optional add-ons (currently `passkey`).
- `scripts/` — Root-level shell scripts for CI, smoke testing, wrangler auth setup, and unreleasing.
- `.github/workflows/` — GitHub Actions for unit tests, smoke tests, playground E2E, nightly matrix runs, and releases.

## Key Abstractions

**Vite Plugin (`redwoodPlugin`)**
The central integration point. It registers a large suite of internal plugins that manage the dev server, production build phases, directive scanning, module resolution, asset linking, and Cloudflare-specific transformations. Understanding that RedwoodSDK is fundamentally a Vite plugin ecosystem is essential to navigating the codebase.

**Request Handler / `defineApp`**
The runtime entry point exported from `rwsdk/worker`. `defineApp` accepts a route tree and returns an object with a `fetch` method suitable for Cloudflare Workers. It implements an ordered, short-circuiting loop: global middleware → RSC actions → page routes.

**Router (`sdk/src/runtime/lib/router`)**
A flattened, type-safe route table built from `route()` and `render()` declarations. It matches incoming requests and can run middleware at global or route-scoped levels. The router is standards-based (returns `Response` objects) rather than framework-magical.

**Directive Scanning and Lookup Maps**
The framework discovers `"use client"` and `"use server"` modules via a custom esbuild scan, then generates virtual lookup modules so React’s RSC and SSR runtimes know how to resolve these boundaries. The production build defers lookup map generation until after tree-shaking, so only used components are included.

**SSR Bridge**
A mechanism that lets the same Cloudflare Worker support both RSC and traditional SSR rendering modes. It uses Vite’s Environments API to manage conflicting dependency requirements and bundles the SSR artifact separately, then links it into the final worker bundle.

**E2E Test Harness (`rwsdk/e2e`)**
A Puppeteer-based testing framework for playground projects. It supports running tests against both the local dev server and temporary Cloudflare deployments. Tests use `setupPlaygroundEnvironment` and helpers like `testDevAndDeploy` and `poll`.

## Conventions Observed

- **Workspace linking**: All internal packages that depend on `rwsdk` use `"rwsdk": "workspace:*"` in their `package.json`.
- **Tests co-located with source**: Unit and plugin tests live next to the files they test (e.g., `directivesPlugin.mts` and `directivesPlugin.test.mts`).
- **Dependency injection over mocking**: Tests pass fake dependencies as arguments rather than using `vi.mock()`.
- **Options objects**: Functions with multiple parameters prefer a single options object.
- **pnpm overrides for security**: The root `package.json` defines many `pnpm.overrides` entries to force secure versions of transitive dependencies.
- **Manifest-first greenkeeping**: `package.json` files are edited directly; the lockfile is regenerated rather than mutated in place.
- **Peer dep stability**: `sdk/package.json` declares `peerDependencies` for user-facing packages (react, vite, wrangler) with careful version ranges.
- **Build via tsc**: The SDK itself is built with `tsc --build --clean && tsc`, not Vite.
- **Formatting with Prettier**: `pnpm format` targets `sdk/src`, `starter/src`, and `addons/passkey/src`.

## Known Unknowns

- The exact Cloudflare deployment configuration (Wrangler toml files) in each playground project was not inspected in detail.
- The realtime subsystem (`use-synced-state`, CapnWeb RPC surface) has architecture docs but the full implementation surface was not explored.
- The `llms/` directory in `sdk/src/` is unexamined — purpose unclear from file names alone.
- The precise release automation scripts inside `sdk/scripts/` and `.github/workflows/` were not read end-to-end.
- How `rwsync` (the dev sync tool) is implemented beyond its high-level behavior description.
