# Directive Scanning and Module Resolution

This document details the internal `esbuild`-based scanner used to discover `"use client"` and `"use server"` directives, and the Vite-aware module resolution it employs.

## The Challenge: Pre-Optimization Discovery

A core requirement of the framework is to know the location of all directive-marked modules *before* Vite's main processing begins.

-   In **development**, this list is needed before Vite's dependency optimizer (`optimizeDeps`) runs, so that the discovered modules can be correctly pre-bundled.
-   In **production**, this list is needed before the initial `worker` build so it can be filtered down to only the modules that are actually used, enabling effective tree-shaking.

Vite does not provide a stable, public API hook at the precise lifecycle point required—after the server and environments are fully configured, but before dependency optimization or the build process begins. This necessitates a custom scanning solution that runs ahead of Vite's own machinery.

## The Solution: A Context-Aware `esbuild` Scanner

We implement a standalone scan using `esbuild` for its high-performance traversal of the dependency graph. The key to making this scan accurate is a custom, Vite-aware module resolver that can adapt its behavior based on the context of the code it is traversing.

### The Challenge of Conditional Exports

A static resolver that uses a single environment configuration for the entire scan is insufficient. Modern packages often use conditional exports in their `package.json` to provide different modules for different environments (e.g., a "browser" version vs. a "react-server" version).

A static scanner starting from a server entry point would use "worker" conditions for all resolutions. When it encounters a `"use client"` directive and traverses into client-side code, it would continue to use those same server conditions, incorrectly resolving client packages to their server-side counterparts and causing build failures.

### Stateful, Dynamic Resolution

To solve this, the scanner's resolver is stateful. It maintains the current environment context (`'worker'` or `'client'`) as it walks the dependency graph.

When resolving an import, the process is as follows:
1.  Before resolving the import, the scanner inspects the *importing* module for a `"use client"` or `"use server"` directive.
2.  Based on the directive (or the inherited context from the file that imported it), the scanner selects one of two `enhanced-resolve` instances:
    *   A **worker resolver**, configured with server-side conditions (e.g., `"react-server"`, `"workerd"`).
    *   A **client resolver**, configured with browser-side conditions (e.g., `"browser"`, `"module"`).
3.  The selected resolver is then used to find the requested module, ensuring the correct conditional exports are used. This resolution process is still fully integrated with Vite's plugin ecosystem, allowing user-configured aliases and paths to work seamlessly in both contexts.

This stateful approach allows the scan to be context-aware, dynamically switching its resolution strategy as it crosses the boundaries defined by directives. It correctly mirrors the runtime behavior of the application, resulting in a reliable and accurate scan.

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
