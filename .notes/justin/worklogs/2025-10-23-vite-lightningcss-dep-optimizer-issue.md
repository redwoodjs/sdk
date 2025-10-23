# 2025-10-23: Vite/lightningcss Dependency Optimizer Issue

## Problem

A user reported a Vite build failure during dependency optimization, with an error message `Could not resolve "../pkg"` from `lightningcss`. The provided reproduction was minimal and did not use our SDK, so the connection was not immediately clear.

The error suggested that `vite` was being included in the dependency graph for a server or worker environment. Vite's dependency scanner would then find an optional dynamic import for `lightningcss`, and the build would fail when it could not resolve the native package (`../pkg`).

The initial theory was that a runtime utility in our SDK, `normalizeModulePath.mts`, might be responsible, as it directly imported a function from `vite`. However, this was just a hypothesis that needed to be confirmed with a proper reproduction.

## The Quest for Reproduction

Reproducing the issue was the first priority. After some investigation, I noticed a screenshot the user had shared on Discord which showed they were working on a specific branch (`codex/add-ssr-support-to-web-adapter`) in their `livestore` monorepo. I decided to check out this branch to attempt a reproduction.

My goal then shifted to getting this monorepo to build so I could run their example. This turned out to be a complex task, involving debugging a C-to-WASM build process for `@livestore/wa-sqlite`, fixing a broken TypeScript project reference setup, and navigating a `devenv`/Nix-based development environment.

After a long series of attempts, I was finally able to get the project to a state where it would run. By adding missing `package.json` dependencies for packages within the workspace (e.g. adapter-web needed dep for adapter-node), I was able to start the Vite dev server for the `web-todomvc-redwood` example.

This successfully reproduced the user's issue, confirming that the problem was real and related to how dependencies were being scanned in the `worker` environment.

## The Root Cause: Uncovering the Import Chain

With a reproduction in hand, the next step was to get definitive proof of the import chain. A theory wasn't good enough.

I added a `console.log` to the `onResolve` hook of our SDK's `knownDepsResolverPlugin`. This logged every module resolution attempt made by esbuild during Vite's dependency scan. By running the example app and piping the logs to a file, I was able to get a complete trace.

The logs provided the "black and white" evidence, revealing a clear chain from the application's runtime code to the `vite` package. The issue was not in our SDK, but in the `livestore` codebase.

Here is the step-by-step import chain:

---

### Step 1: Entry Point (`worker.tsx`)

The process starts in the example app's worker entry point, which is responsible for server-side rendering. It imports and renders the `Home` component.

*   **File:** [`examples/web-todomvc-redwood/src/worker.tsx#L6`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/examples/web-todomvc-redwood/src/worker.tsx#L6)
*   **Code:**
    ```tsx
    // ...
    import { Home } from '@/app/pages/Home'
    // ...
    export default defineApp([setCommonHeaders(), render(Document, [route('/', Home)])])
    ```

### Step 2: The `Home` Component

The `Home.tsx` page component, which is rendered on the server, imports a function to create a server-side snapshot of the database state.

*   **File:** [`examples/web-todomvc-redwood/src/app/pages/Home.tsx#L1`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/examples/web-todomvc-redwood/src/app/pages/Home.tsx#L1)
*   **Code:**
    ```tsx
    import { createWebAdapterSsrSnapshot, encodeWebAdapterSsrSnapshot } from '@livestore/adapter-web'
    ```

### Step 3: `@livestore/adapter-web`'s SSR Utility

The main entry point for `@livestore/adapter-web` re-exports the SSR snapshot function from its `ssr.ts` module.

*   **File:** [`packages/@livestore/adapter-web/src/index.ts#L9`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-web/src/index.ts#L9)
*   **Code:**
    ```typescript
    export {
      // ...
      createWebAdapterSsrSnapshot,
      // ...
    } from './ssr.ts'
    ```

### Step 4: Crossing the Boundary to `@livestore/adapter-node`

The `ssr.ts` utility within the *web* adapter imports the `makeAdapter` function from the *node* adapter to perform the server-side work.

*   **File:** [`packages/@livestore/adapter-web/src/ssr.ts#L2`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-web/src/ssr.ts#L2)
*   **Code:**
    ```typescript
    import { makeAdapter as makeNodeAdapter } from '@livestore/adapter-node'
    ```

### Step 5: `@livestore/adapter-node`'s Adapter Implementation

The main entry point for `@livestore/adapter-node` re-exports the adapter implementation from a deeper module.

*   **File:** [`packages/@livestore/adapter-node/src/index.ts#L1`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-node/src/index.ts#L1)
*   **Code:**
    ```typescript
    export { makeAdapter, makeWorkerAdapter } from './client-session/adapter.ts'
    ```

### Step 6: The Missing Link

Here is the key connection. The `client-session/adapter.ts` file, which contains the core logic for the node adapter, imports `makeLeaderThread` from `leader-thread-shared.ts`.

*   **File:** [`packages/@livestore/adapter-node/src/client-session/adapter.ts#L44`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-node/src/client-session/adapter.ts#L44)
*   **Code:**
    ```typescript
    // ...
    import { makeLeaderThread } from '../leader-thread-shared.ts'
    // ...
    ```

### Step 7: The Problematic Dynamic Import

This `leader-thread-shared.ts` file is where the core problem lies. This shared runtime code contains a **dynamic `import()` for the devtools server**. Even though it's dynamic, Vite's dependency scanner detects it and pulls it into the dependency graph.

*   **File:** [`packages/@livestore/adapter-node/src/leader-thread-shared.ts#L155`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-node/src/leader-thread-shared.ts#L155)
*   **Code:**
    ```typescript
    // ...
    const { startDevtoolsServer } = yield* Effect.promise(() => import('./devtools/devtools-server.ts'))
    // ...
    ```

### Step 8 & 9: Chaining to Vite

From here, the chain is straightforward. The devtools server imports the Vite middleware, which in turn imports `vite` itself.

*   **File:** [`packages/@livestore/adapter-node/src/devtools/devtools-server.ts#L21`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-node/src/devtools/devtools-server.ts#L21)
    *   **Imports:** `makeViteMiddleware` from `./vite-dev-server.ts`
*   **File:** [`packages/@livestore/adapter-node/src/devtools/vite-dev-server.ts#L9`](https://github.com/livestorejs/livestore/blob/77b66c70c2bf287dbbe3b0e067a1f3c1cbf67bf5/packages/@livestore/adapter-node/src/devtools/vite-dev-server.ts#L9)
    *   **Imports:** `* as Vite from 'vite'`

---

This chain proves that a runtime file in `@livestore/adapter-node` is importing a dev-only utility that starts a Vite server. This is an architectural issue in the `livestore` codebase. The user's bug report is a symptom of this issue, triggered by their specific Vite configuration. The problem is not with our SDK.
