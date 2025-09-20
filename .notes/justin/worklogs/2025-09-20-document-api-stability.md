# Work Log: 2025-09-20 - Documenting API Stability

## 1. Problem Definition & Goal

The SDK's public APIs lack clear documentation regarding their stability. Users, particularly those considering the SDK for production use, have no way of knowing which features are considered stable and which are experimental and subject to breaking changes. This can lead to user friction and uncertainty.

The goal is to investigate the SDK's public API surface, research best practices for communicating API stability, and implement a clear, maintainable documentation system that explicitly labels features as "Stable" or "Experimental".

## 2. Investigation: Discovering the Public API

The first step was to create a comprehensive list of all public-facing APIs. This was a multi-step process.

### 2.1. `package.json` Exports

I started by analyzing the `exports` map in `sdk/package.json`. This provided the primary, official entry points for the package. I filtered out internal entry points (those prefixed with `__`) to focus on the intended public surface.

The key entry points identified were:
- `rwsdk/vite`
- `rwsdk/worker`
- `rwsdk/client`
- `rwsdk/router`
- `rwsdk/auth`
- `rwsdk/db`
- `rwsdk/debug`
- `rwsdk/constants`
- `rwsdk/turnstile`
- `rwsdk/llms`
- `rwsdk/realtime/*`

### 2.2. Source Code Analysis

I then traced each of these entry points back to their source files in `sdk/src/` to determine exactly what functions, classes, and types were being re-exported. This involved reading through files like `sdk/src/runtime/entries/worker.ts`, `sdk/src/runtime/lib/router.ts`, etc., to build a complete picture.

This analysis produced a detailed list of every public API, from high-level functions like `defineApp` and `initClient` to more specific utilities like `defineSessionStore` and `createDb`.

The full, compiled list of public APIs can be found in the final section of this work log.

## 3. The Solution: A Hybrid Documentation Strategy

After identifying the APIs, the next step was to determine the best way to communicate their stability.

### 3.1. Research and Discarded Ideas

I researched how popular, modern projects like Node.js, Vite, and TypeScript handle this.

- **Node.js:** Uses a formal "Stability Index" (e.g., "Stability: 2 - Stable"). This is very precise but felt overly bureaucratic for our current needs.
- **Purely Centralized List:** The initial user request mentioned a single stability page. While useful for an overview, I concluded that a single page would be a maintenance bottleneck and that users would benefit more from seeing stability information in the context of the feature they are reading about.

### 3.2. The Chosen Strategy

I landed on a hybrid approach that combines the clarity of a central definition with the convenience of inline warnings, a pattern common across many modern libraries.

1.  **A Central "API Stability" Page:** I created a new page at `docs/src/content/docs/stability.mdx`. This page serves two purposes:
    *   It **defines** what "Stable" and "Experimental" mean in the context of our SDK, setting clear user expectations about semantic versioning and breaking changes.
    *   It provides a **high-level overview** table of the main feature areas and their current stability status.

2.  **Inline Banners:** For features explicitly marked as experimental (`Database` and `Realtime`), I added a prominent `<Aside>` component (a banner) to the top of their respective documentation pages. This banner clearly labels the feature as experimental and links back to the main "API Stability" page for more details.

This hybrid model is the most maintainable and user-friendly. The central page defines the contract, which changes infrequently. The inline banners are updated as part of the documentation workflow for a specific feature, ensuring the information is always in the right context.

### 3.3. Implementation Details

- Created `docs/src/content/docs/stability.mdx`.
- Added a link to the new page in the sidebar in `docs/astro.config.mjs`.
- Added experimental banners to:
  - `docs/src/content/docs/core/database.mdx`
  - `docs/src/content/docs/core/database-do.mdx`
  - `docs/src/content/docs/core/realtime.mdx`

## 4. Final Public API List & Stability Classification

This is the final list of public APIs compiled during the investigation, along with the stability classification applied.

**Stable APIs**
- **Vite Plugin (`rwsdk/vite`)**: `redwood()`
- **Core Worker (`rwsdk/worker`)**: `defineApp()`, `renderToString()`, `renderToStream()`, `getRequestInfo()`, `registerServerReference()`, `rscActionHandler()`, `ErrorResponse`, `defineScript()`, `generateNonce()`.
- **Core Client (`rwsdk/client`)**: `initClient()`, `createServerReference()`, `initClientNavigation()`.
- **Routing (`rwsdk/router`)**: `defineRoutes()`, `route()`, `layout()`, `defineLinks()`, etc.
- **Authentication (`rwsdk/auth`)**: `defineSessionStore()`, `defineDurableSession()`.
- **Turnstile (`rwsdk/turnstile`)**: `TurnstileScript`, `useTurnstile()`, `verifyTurnstileToken`.
- **Utilities**: `debug` (`rwsdk/debug`), `constants` (`rwsdk/constants`).

**Experimental APIs**
- **Database (`rwsdk/db`)**: The entire database API, including `createDb()`, `SqliteDurableObject`, and migration helpers.
- **Realtime (`rwsdk/realtime/*`)**: All realtime features, including `initRealtimeClient()`, `realtimeRoute()`, `RealtimeDurableObject`, and `renderRealtimeClients()`.

**Internal APIs**
- **LLMs (`rwsdk/llms`)**: Determined to be for internal tooling (`vibe-rules`) and not a public-facing API for end-users.
