# Directive Scanning and Module Resolution

This document details the internal `esbuild`-based scanner used to discover `"use client"` and `"use server"` directives, and the Vite-aware module resolution it employs.

## The Challenge: Pre-Optimization Discovery

A core requirement of the framework is to know the location of all directive-marked modules *before* Vite's main processing begins.

-   In **development**, this list is needed before Vite's dependency optimizer (`optimizeDeps`) runs, so that the discovered modules can be correctly pre-bundled.
-   In **production**, this list is needed before the initial `worker` build so it can be filtered down to only the modules that are actually used, enabling effective tree-shaking.

Vite does not provide a stable, public API hook at the precise lifecycle point required—after the server and environments are fully configured, but before dependency optimization or the build process begins. This necessitates a custom scanning solution that runs ahead of Vite's own machinery.

## The Solution: A Vite-Aware `esbuild` Scanner

We implement a standalone scan using `esbuild` for its high-performance traversal of the dependency graph. The key to making this scan accurate is a custom, Vite-aware module resolver.

The resolver is built upon `enhanced-resolve` (the same resolver used by Webpack) and extended with a custom plugin. This plugin bridges the gap between `esbuild` and Vite by integrating Vite's own plugin ecosystem into the resolution process.

When resolving a module, the process is:
1.  The `esbuild` scan requests a module.
2.  Our custom resolver first attempts to find it using a standard `enhanced-resolve` configuration.
3.  If that fails, our custom plugin iterates through the application's configured Vite plugins (e.g., `vite-tsconfig-paths`) and calls their `resolveId` hooks, effectively asking each plugin if it knows how to resolve the module.

This approach creates a resolver that is both fast and fully compatible with the dynamic, plugin-based resolution that makes Vite powerful. It is a simplified subset of Vite's full resolution logic, tailored specifically for the directive scan.

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
