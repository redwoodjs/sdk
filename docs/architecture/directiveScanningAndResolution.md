# Directive Scanning and Module Resolution

This document details the internal `esbuild`-based scanner used to discover `"use client"` and `"use server"` directives, and the Vite-aware module resolution it employs.

## The Challenge: A Comprehensive and Correct Pre-Scan

A core requirement of the framework is to know the location of all directive-marked modules *before* Vite's main processing begins. This is necessary in development for Vite's dependency optimizer (`optimizeDeps`) and in production for effective tree-shaking. Because Vite lacks a public API hook at this specific lifecycle point, a custom scanning solution is required.

A naive scan starting from the application's entry points is insufficient for two key reasons:

1.  **It cannot handle conditional exports.** A scan starting from a server entry point would use server-side resolution conditions for the entire dependency graph. When it crosses a `"use client"` boundary, it would fail to switch to browser-side conditions, leading to incorrect module resolution and build failures.
2.  **It misses undiscovered modules.** If a directive-containing file exists in the project but is not yet imported by any other file in the graph, an entry-point-based scan will not find it. If a developer later adds an import to that file, the directive map becomes stale, causing "module not found" errors during Server-Side Rendering (SSR).

## The Solution: A Two-Phase, Context-Aware Scan

To address these challenges, the framework implements a two-phase scan that is both comprehensive and contextually aware.

### Phase 1: Glob-based Pre-Scan for All Potential Modules

The first phase solves the "stale map" problem by finding all files in the application's codebase that could *potentially* contain a directive, regardless of whether they are currently imported.

-   A fast `glob` search is performed across the `src/` directory for all relevant file extensions (`.ts`, `.tsx`, `.js`, `.mdx`, etc.).
-   This initial list of files is then filtered down to only those that actually contain a `"use client"` or `"use server"` directive.
-   This process ensures that even currently-unimported modules are identified upfront, "future-proofing" the directive map against code changes made during a development session. Caching is used to optimize performance.

### Phase 2: Context-Aware `esbuild` Traversal

The second phase solves the module resolution problem by using `esbuild` to traverse the dependency graph with a stateful, Vite-aware resolver.

The entry points for this phase are a combination of the application's main entry points and the set of directive-containing files discovered in Phase 1. As the scanner traverses the graph, its resolver maintains the current environment context (`'worker'` or `'client'`).

When resolving an import, the process is as follows:
1.  Before resolving the import, the scanner inspects the *importing* module for a `"use client"` or `"use server"` directive.
2.  Based on the directive (or the inherited context from the file that imported it), the scanner selects one of two `enhanced-resolve` instances:
    *   A **worker resolver**, configured with server-side conditions (e.g., `"react-server"`, `"workerd"`).
    *   A **client resolver**, configured with browser-side conditions (e.g., `"browser"`, `"module"`).
3.  The selected resolver is then used to find the requested module, ensuring the correct conditional exports are used. This resolution process is still fully integrated with Vite's plugin ecosystem, allowing user-configured aliases and paths to work seamlessly in both contexts.

This two-phase approach—combining a comprehensive glob pre-scan with a context-aware `esbuild` traversal—results in a reliable and accurate scan that is resilient to both complex package structures and mid-session code changes.

## Rationale and Alternatives

This custom resolver approach was chosen after investigating several alternatives that proved to be inconsistent or unstable.

### Why not use Vite's `createIdResolver`?

Vite exports a `createIdResolver` function, which provides access to some of its internal resolution logic. However, this resolver is intentionally minimal. It creates an isolated plugin container that only includes Vite's internal `alias` and `resolve` plugins. It does not include the full suite of user-provided plugins from the main Vite configuration. This means a scan using `createIdResolver` would be blind to modules resolved by other plugins (like `vite-tsconfig-paths`), making it incomplete and unreliable for projects with custom resolution configurations.

### Why not use `environment.pluginContainer.resolveId`?

In development mode, the Vite server `environment` has a fully-formed `pluginContainer` with a `resolveId` method that *does* have access to all user plugins. While using this would work perfectly in dev, the `pluginContainer` object is not created or exposed during a production build. Relying on this would introduce a critical inconsistency, where the scan could succeed in development but fail in production. A consistent resolution mechanism across both modes is essential for reliability.

### Why not access Vite's internal plugin container functions?

While Vite has internal functions to create a `pluginContainer` for the build environment, they are not part of its public API. Accessing them would require importing from hashed, internal distribution files (e.g., `dep-DBxKXgDP.js`). This would make our build process extremely brittle, as these internal file hashes change with every Vite release. A solution that relies only on stable, public APIs is a core requirement for maintainability.

### Why not cache the scan results?

While caching scan results across server restarts is a potential future optimization, the primary goal of the current implementation is correctness and reliability. The dynamic nature of a project's dependency graph, influenced by the full Vite plugin ecosystem, makes cache invalidation a complex challenge. For now, the focus is on guaranteeing a correct and consistent scan on every run, which is achieved with the current high-performance resolver.
