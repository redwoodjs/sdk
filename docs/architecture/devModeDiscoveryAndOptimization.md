# Dev Mode Discovery and Optimization

This document describes the challenges and solutions related to dependency discovery and optimization in the development environment. The core problem revolves around the tension between Vite's dependency pre-bundling feature (`optimizeDeps`) and the on-demand, dynamic nature of React Server Components (RSC).

## The Challenge: The SPA Dilemma vs. RSC Reality

Vite's `optimizeDeps` is a crucial performance feature. It addresses the "waterfall" problem inherent in native ES modules by scanning for dependencies in `node_modules` and pre-bundling them into single, larger JavaScript files. This is particularly effective for large libraries with many internal modules. The browser can then fetch one large, optimized chunk in parallel, rather than making hundreds of sequential requests. This pre-bundling is also cached, making subsequent server starts much faster.

This model works perfectly for a traditional Single-Page Application (SPA), where the bundler can often determine most of the necessary dependencies by statically analyzing the application's entry point.

However, our architecture presents a different challenge. Due to the nature of RSCs, components with a `"use client"` directive are not part of the initial server bundle. They are fetched on-demand by the browser as the user navigates and interacts with the application. This means we cannot know at startup which client components from a large library (like Mantine, where nearly every component is a client component) will actually be used.

A naive implementation that dynamically imports each client component as needed (`import('/path/to/node_modules/.../Button.mjs')`) completely bypasses Vite's `optimizeDeps` feature. The dev server sees these as requests for raw source files, leading to the exact "request waterfall" problem that `optimizeDeps` was designed to solve, resulting in a slow and frustrating developer experience.

## The Solution: A Surgical, Hybrid Approach

To solve this, we adopt a hybrid approach that guides Vite's optimizer with the information it needs, while still respecting the dynamic nature of our application. The solution has two main parts.

### 1. Guiding the Optimizer

Instead of letting Vite's scanner discover dependencies from a single entry point (which is insufficient for our needs), we take a more proactive role.

At server startup, our build plugin performs a fast scan of the project's `node_modules` directory to find all packages that contain files with the `"use client"` directive. The names of these packages (e.g., `@mantine/core`) are then passed directly to Vite's `optimizeDeps.include` configuration.

This forces Vite to create the comprehensive, pre-bundled chunks we need for each UI library, solving the "sane optimization" part of the problem.

### 2. Static Analysis via Virtual Module

With the optimized bundles in place, we still need to bridge the gap between our runtime's need for a specific component and Vite's ability to resolve it from the correct bundle.

We achieve this with a virtual module, `virtual:use-client-lookup`. This module is generated in memory and acts as a central registry for all client components. The key to its effectiveness is how it imports dependencies from `node_modules`:

1.  **Static Imports:** For every client component discovered in `node_modules`, the virtual module includes a static `import * as _N from '...'` statement at the top level. Crucially, this import uses a **bare module specifier** (e.g., `import * as _0 from '@mantine/core/esm/Button/Button.mjs'`).
2.  **Static Analysis:** Because these are static, top-level imports, Vite's scanner can see them during its analysis phase. It recognizes `@mantine/core` as a dependency that has been pre-bundled and correctly resolves the deep import path from within the existing optimized chunk. This all happens on the server before any code is sent to the browser.
3.  **Instant Resolution:** The body of the virtual module then creates a lookup map. When the application's runtime asks for the Mantine `Button`, the lookup function doesn't trigger a new network request; it simply returns a promise that resolves instantly with the already-imported `_0` module namespace.

For client components within the local application source (`/src`), the module continues to use standard dynamic `import()` statements, preserving the benefits of fast, individual file serving and HMR for active development.

## The Trade-off

This solution involves an explicit trade-off. By eagerly pre-bundling entire libraries, the **initial server startup may be slightly slower** on a cold start. However, in exchange, the **in-session developer experience is fast and smooth**, free of the request waterfalls and layout shifts that would otherwise occur. This is the correct and worthwhile trade-off for a productive development workflow.
