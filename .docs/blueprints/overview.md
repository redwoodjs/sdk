# RedwoodSDK Monorepo Blueprint

## 2000ft View

RedwoodSDK is a server-first React framework built for Cloudflare Workers (workerd). It provides a Vite plugin that enables React Server Components (RSC), Server Functions, and a type-safe router, all running on the edge. Developers define routes and middleware in a single `worker.tsx` entry point; the framework handles streaming HTML, client hydration, and RPC for server actions. The project is a pnpm monorepo containing the core SDK (`rwsdk`), a starter template, documentation site, community extensions, playground examples, and optional addons.

## System Flow

The developer-facing entry point is a `worker.tsx` file that exports a `defineApp()` call containing an array of routes and middleware. At dev time, the Redwood Vite plugin (`sdk/src/vite/redwoodPlugin.mts`) configures multiple Vite environments (`worker`, `client`, `ssr`) and runs an esbuild-based directive scanner to discover `"use client"` and `"use server"` modules.

For production, the build proceeds in five phases: (1) an initial esbuild scan finds all directive modules; (2) the worker environment is built and tree-shaken to determine which client components are actually used; (3) the SSR environment is built with the pruned client list; (4) the client environment is built, producing hashed assets and a `manifest.json`; (5) a final "linker" pass reuses the worker environment to bundle the intermediate artifacts together and rewrite asset placeholders to final paths.

At runtime inside a Cloudflare Worker, the `fetch` handler iterates through a flattened route table in definition order. Middleware may short-circuit by returning a `Response`. Once a matching route is found, any pending RSC action is executed, then the route handler runs. For page loads, the framework renders the page as an RSC payload, forks the stream, consumes one branch with the SSR runtime to produce HTML, and stitches it into the `Document` shell. Client-side navigation uses the same RSC payload stream consumed by the browser.

## Directory Map

- `sdk/` — Core framework package (`rwsdk`). Contains the Vite plugin (`src/vite/`), runtime worker/router/render code (`src/runtime/`), CLI scripts (`src/scripts/`), e2e test utilities (`src/lib/e2e/`), and LLM rule files (`src/llms/`).
- `starter/` — Minimal starter template. A reference app that consumes `rwsdk` via workspace link and demonstrates the standard `worker.tsx`, `document.tsx`, `client.tsx` structure.
- `docs/` — Documentation site built with the SDK itself. Includes architecture deep-dives under `docs/architecture/`.
- `community/` — Community extensions and utilities. Exports worker, client, and test entry points.
- `playground/` — Example applications used primarily for end-to-end testing. Each sub-directory is a standalone app exercising specific SDK features.
- `addons/` — Optional framework add-ons (e.g., `passkey`).
- `scripts/` — Root-level shell scripts for CI tasks such as wrangler auth setup and release utilities.
- `.github/workflows/` — GitHub Actions for CI, e2e tests, smoke tests, releases, and code quality.
- `examples/` — Additional examples (sparse).

## Key Abstractions

**`defineApp(routes, options)`** — The top-level factory in `sdk/src/runtime/worker.tsx` that creates the application object with a `fetch` handler. It accepts a flat or nested array of routes and middleware, plus options like `allowedOrigins` for cross-origin server actions.

**Router (`sdk/src/runtime/lib/router.ts`)** — A sequential, short-circuiting request router. Routes are defined with `route()`, `prefix()`, `layout()`, and `render()` helpers, then flattened into a linear table at initialization. The first matching route wins. Middleware can return a `Response` to abort further processing.

**Redwood Vite Plugin (`sdk/src/vite/redwoodPlugin.mts`)** — The framework's build engine. It wires together dozens of custom Vite plugins for directive scanning, module resolution, SSR bridge management, HMR stability, asset linking, and production build orchestration. It is the primary integration point with Vite and the Cloudflare Vite plugin.

**Request Info / Context** — A request-scoped context object populated by middleware and accessible to route handlers. It carries user-defined context, request metadata, and is managed via async-local-storage-like utilities in `sdk/src/runtime/requestInfo/`.

**Stream Stitching (`sdk/src/runtime/lib/stitchDocumentAndAppStreams.ts`)** — The runtime mechanism that combines the HTML stream from the `Document` shell with the application HTML stream produced by SSR-consuming-RSC. It ensures valid HTML output and enables early hydration by injecting the client entry script without blocking on suspended data.

**`rwsync`** — A development CLI tool shipped in `sdk/bin/rwsync` that rebuilds the SDK and syncs it into an external project. Within the monorepo it primarily provides watch mode, since workspace linking handles the sync automatically.

## Conventions Observed

- **Package manager**: pnpm with workspace configuration in `pnpm-workspace.yaml`. Node >=24.14 and pnpm >=10.31 are required.
- **Language**: TypeScript throughout; ESM only (`"type": "module"`).
- **Tests**: Co-located with source files as `*.test.mts` or `*.test.ts`; benchmarks use `*.bench.ts`. E2E tests live in `playground/**/__tests__/e2e.test.mts` and are driven by Vitest with a Puppeteer-based global setup.
- **Architecture documentation**: Deep-dive docs live in `docs/architecture/` and explain the "why" behind build and runtime decisions.
- **Workspace linking**: `starter/` and `playground/` projects reference the SDK via `"rwsdk": "workspace:*"`. Changes to the SDK source are immediately available after rebuilding.
- **Build verification**: Root `package.json` scripts include `build:sdk`, `typecheck:starter`, `build:community`, and `typecheck:community` for quick validation.
- **CI guardrails**: Playground examples in `playground/` require E2E tests. Community playground examples are exempt.
- **Dependency overrides**: The root `package.json` contains an extensive `pnpm.overrides` block used to pin transitive dependencies for security and compatibility.

## Known Unknowns

- **Exact addon build/publish flow**: The `addons/passkey/` directory exists but its build integration and release mechanics are not fully clear from a quick pass.
- **Database integration depth**: The SDK depends on `kysely` and `kysely-do`, and the starter references D1, but the full database abstraction layer has not been inspected.
- **Realtime subsystem details**: `use-synced-state` and `realtime` modules reference CapnWeb and Durable Objects; the exact wire protocol and DO lifecycle are not yet mapped.
- **Smoke test internals**: The smoke testing strategy mentions tarball-based cross-package-manager validation, but the full test matrix and execution flow are not examined.
- **Windows-specific debug workflow**: A dedicated `windows-debug.yml` workflow and PowerShell scripts exist; their purpose and trigger conditions are not explored.