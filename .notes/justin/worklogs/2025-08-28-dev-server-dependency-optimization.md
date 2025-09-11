# Work Log: 2025-08-28 - Optimizing Dev Server Dependencies

## 1. Problem Definition & Goal

The primary goal is to improve the developer experience by optimizing how dependencies are handled in the dev server. The core problem has two symptoms:

*   **Slow Initial Startup:** The server takes a long time to become ready.
*   **In-Browser Request Waterfalls:** When using a component from a large library (like Mantine), the browser makes many sequential requests for individual module files, leading to noticeable lag and layout shifts during development.

This was happening because our method for handling client components from third-party libraries was causing an adverse interaction with Vite's dependency optimizer (`optimizeDeps`). To support potentially internal, un-exported components, we were providing Vite with the file path of *every* discovered `"use client"` module as a distinct entry point. In response, `esbuild` would perform extreme code-splitting to maximize reuse, creating hundreds of tiny, fragmented chunks. This hyper-fragmentation was the direct cause of the request waterfall.

## 2. Investigation: Discarded Ideas & Why

We explored several potential solutions, each with a critical flaw:

### Discarded Idea #1: Use esbuild's `metafile` from the `onEnd` hook
*   **What it was:** After Vite's `optimizeDeps` run, we would inspect a `metafile` report to get a precise list of *used* files and filter our list.
*   **Why it was discarded:** Vite does not expose the `metafile` option for `optimizeDeps`. This approach was technically infeasible.

### Discarded Idea #2: Run our own preliminary esbuild pass (the "Two-Pass Strategy")
*   **What it was:** Before Vite starts, we would run our own fast, in-memory esbuild pass on the application's entry points to generate a `metafile` of all reachable files. We'd then use this perfect information to configure `optimizeDeps`.
*   **Why it was discarded:** A naive, standalone esbuild pass would not be aware of the project's Vite configuration, specifically `resolve.alias`. It would fail to resolve aliased paths (e.g., `~/components`), making the solution too fragile for real-world projects.

### Discarded Idea #3: Scan `node_modules` for directives
*   **What it was:** A simpler approach where our existing `findFilesContainingDirective` function would scan the entire `node_modules` directory.
*   **Why it was discarded:** Scanning all of `node_modules` on every server start would be unacceptably slow and defeat the entire purpose of the optimization.

---

## 3. The **ultimately failed** Solution attempt (The Hybrid Approach)

We landed on a pragmatic, hybrid solution that leverages the strengths of both file scanning and Vite's internal machinery, while respecting their limitations.

*   **Step 1: Fast, Targeted Scan of App Code:** Use our `findFilesContainingDirective` function, but strictly limited to scanning only the local application source (`src/`) directory. It will explicitly exclude `node_modules`. This is a very fast operation.

*   **Step 2: Guide Vite's Own Scanner:** The list of *local* `use client` files found in Step 1 is then passed to Vite's configuration:
    *   The file paths are added to **`optimizeDeps.entries`**. This is the crucial instruction. It tells Vite's own powerful, **alias-aware** scanner to trace all the dependencies of our local client components.
    *   When the scanner sees an `import` from a library (e.g., `import { Button } from '@mantine/core'`), it automatically discovers that library.

*   **Step 3: Trigger the "Comprehensive Bundle":** Once Vite discovers a library like `@mantine/core` this way, it adds the *entire package* to its pre-bundling process. This solves the request waterfall and prevents disruptive mid-session re-bundles.

## 4. Rationale & Key Trade-off

*   **Why this works:** It's fast because our manual scan is limited to a small directory. It's robust because we delegate the complex, alias-aware dependency tracing to Vite's own internal, correctly configured scanner.
*   **The Accepted Trade-off:** We are accepting a potentially slower initial server startup because we are pre-bundling entire libraries, not just the used files. However, in exchange, the developer experience during the session will be perfectly smooth, with no request waterfalls and no disruptive re-bundling when new components from an already-bundled library are used.

**End of Day Status:** The hybrid approach seemed like the most viable path forward, despite the trade-off. However, after implementation, it was found to be an **ultimately failed** attempt, for reasons that were not documented at the time.
