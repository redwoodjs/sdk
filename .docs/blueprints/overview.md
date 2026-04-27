# RedwoodSDK Monorepo Blueprint

## 2000ft View

RedwoodSDK (rwsdk) is a server-first React framework targeting Cloudflare Workers. It provides a Vite plugin that enables React Server Components (RSC) and Server Functions, plus a type-safe router built on web standards. Developers use it to build full-stack applications where the worker is the runtime, HTML is streamed from the edge, and client-side hydration happens via inline script imports. The monorepo contains the core SDK, a starter template, official and community playground examples, documentation site, and community extensions.

## System Flow

The developer experience flows through Vite and the custom Redwood plugin:

1. **Dev/Build Entry**: The user runs `vite dev` or `vite build`. Vite loads `redwoodPlugin` from `sdk/src/vite/redwoodPlugin.mts`.
2. **Plugin Orchestration**: `redwoodPlugin` composes dozens of internal Vite plugins -- for directive scanning, SSR bridge management, dev-server stability, Cloudflare Workers integration, and production asset handling.
3. **Directive Discovery**: An esbuild-based scanner discovers `"use client"` and `"use server"` directives across the source tree. This feeds into transform plugins that rewrite client components for RSC/SSR and convert server functions into RPC proxies.
4. **Request Handling**: In production, a Cloudflare Worker entry (`src/worker.tsx` in the app) uses `defineApp` from `rwsdk/worker`. The router (`sdk/src/runtime/lib/router.ts`) matches incoming requests against a flattened route table, running middleware and handlers in a short-circuiting loop.
5. **Rendering**: For page routes, the framework performs hybrid rendering -- parallel RSC and SSR streams that are stitched together before being sent to the browser. Client scripts are discovered and preloaded automatically.
6. **Client Hydration**: The browser loads an inline `import()` that pulls in the client entry, enabling early hydration before the full stream completes.

## Directory Map

- `sdk/` -- Core SDK package (`rwsdk` on npm). Contains Vite plugins, runtime entries, router, render pipeline, e2e test harness, and dev scripts.
- `starter/` -- Bare-bones template project used by `create-rwsdk`. Shows standard app structure with `src/app/pages/` and `src/worker.tsx`.
- `playground/` -- Official SDK test projects, each verifying a specific feature in isolation. These have mandatory E2E tests and run in CI.
- `community/` -- Community extensions (`rwsdk-community`) and their playground showcases. Less strict test requirements.
- `community/playground/` -- Community-contributed demo apps.
- `docs/` -- Documentation site built with fumadocs and RedwoodSDK itself.
- `addons/` -- Optional add-ons (currently `passkey`).
- `examples/` -- Additional example projects.
- `scripts/` -- Root-level shell scripts for CI, testing, and release management.
- `.github/workflows/` -- GitHub Actions for CI, release, and community releases.

### sdk/src/ subdirectories

- `vite/` -- Vite plugin implementations (~40 modules). The heart of the build/dev tooling.
- `runtime/` -- Framework runtime: router, rendering, client navigation, request info context, server function handling.
- `runtime/entries/` -- Barrel exports for `rwsdk/worker`, `rwsdk/client`, `rwsdk/router`, etc.
- `lib/` -- Shared utilities, e2e testing infrastructure, smoke test helpers.
- `llms/` -- LLM-related utilities and rules.
- `scripts/` -- SDK-internal scripts (smoke tests, debug sync).
- `use-synced-state/` -- Realtime state synchronization primitives using Durable Objects.

## Key Abstractions

**RedwoodPlugin (`sdk/src/vite/redwoodPlugin.mts`)**
The main Vite plugin returned by `redwoodPlugin()` composes the entire build and dev toolchain. It wires together React, Cloudflare, directive scanning, SSR bridging, and production build orchestration. Any change to how the framework integrates with Vite flows through here.

**Router (`sdk/src/runtime/lib/router.ts`)**
A flattened, prefix-tree-based router that maps URL paths to handlers. Routes can be functions, components, or middleware chains. It supports HTTP method handlers, exception handlers (`__rwExcept`), and per-route middleware. The router is the primary abstraction for request-to-response mapping.

**SSR Bridge (`sdk/src/vite/ssrBridgePlugin.mts`)**
The SSR Bridge allows the same codebase to support both RSC and traditional SSR rendering modes within a single Cloudflare Worker. It uses Vite's Environments API to manage conflicting dependency requirements between the two runtimes.

**Directive Scanning and Transforms**
The framework scans source files for `"use client"` and `"use server"` directives using esbuild. Client components are transformed differently for RSC vs SSR consumption. Server functions are rewritten into secure RPC proxies that serialize arguments and responses across the network boundary.

**Request Info Context (`sdk/src/runtime/requestInfo/`)**
A context object that flows through the request handling pipeline, carrying the current request, URL, params, and other request-scoped state. Middleware and route handlers receive this context.

**E2E Test Harness (`sdk/src/lib/e2e/`)**
A custom end-to-end testing framework for playground apps. It handles browser management (via Puppeteer), dev server orchestration, concurrent test execution, and artifact collection. This is the primary testing layer for SDK features.

## Conventions Observed

- **pnpm workspaces** manage the monorepo. Packages link to the SDK via `"rwsdk": "workspace:*"`.
- **Tests are co-located** with source files: `*.test.mts` and `*.bench.ts` sit next to the files they test.
- **TypeScript `~` ranges** are common in SDK dependencies for controlled updates. Playgrounds and docs tend to use pinned or `^` ranges.
- **Manifest-first updates**: `package.json` files are edited directly; lockfile is regenerated afterward.
- **pnpm overrides** in the root `package.json` are used to force transitive dependency versions, especially for security advisories.
- **Playground scripts** are standardized: `dev`, `build`, `check`, `types`, `generate`, `release`, `worker:run`.
- **CI runs E2E tests** on `playground/` examples but not on `community/playground/` examples.
- **Worker entry convention**: App worker entry is `src/worker.tsx`, exporting `defineApp([...])`.

## Known Unknowns

- Exact Cloudflare Workers compatibility matrix for each Wrangler/Vite-plugin version bump.
- Whether Vite 8.x (latest) is compatible with the current SDK peer dependency range (`^6.2.6 || 7.x`).
- Full extent of `community/playground/` projects -- the directory tree was only partially explored.
- How `capnweb` (optional peer dep) and `use-synced-state` Durable Object integration is tested in CI.
- Whether the `docs/` site build is exercised in the standard `pnpm check` workflow.
