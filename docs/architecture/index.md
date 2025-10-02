# RedwoodSDK architecture documentation 

This collection of documents provides a high-level overview of the core architectural concepts and mechanisms within the RedwoodSDK. They are intended to explain the "why" behind key design decisions, focusing on the problems encountered and the solutions implemented.

- [**The SSR Bridge**](./ssrBridge.md)
  This document details the architecture that allows the framework to support two different rendering environments (RSC and traditional SSR) within a single Cloudflare Worker. It explains how the "SSR Bridge" uses Vite's Environments API to manage conflicting dependency requirements between the two runtimes.

- [**Supporting Client-Side Stylesheet Imports**](./clientStylesheets.md)
  This document explains how the framework handles CSS imports within "use client" components. It details the process of discovering, bundling, and injecting stylesheets to prevent a "Flash of Unstyled Content" (FOUC) in production environments, while managing the trade-offs for a fast development experience.

- [**Document Component Transformations**](./documentTransforms.md)
  Learn about the automated source code transformations applied to the main `Document.tsx` component. This document covers how the build process rewrites asset paths for production, injects security nonces into script tags, and discovers client-side entry points.

- [**Preloading Client-Side Scripts**](./preloading.md)
  This document describes the strategy for improving page load performance by preloading client-side JavaScript modules. It explains how the server identifies required scripts during rendering and sends resource hints to the browser to flatten the typical request waterfall.

- [**The Production Build Process**](./productionBuildProcess.md)
  This document outlines the multi-phase build process used for production environments. It explains how the framework orchestrates multiple, inter-dependent Vite environments (`worker`, `client`, `ssr`) with circular information dependencies into a reliable, sequential build.

- [**Dev Server Dependency Optimization**](./devServerDependencyOptimization.md)
  This document outlines the strategy and mechanisms used to optimize the development server's dependency resolution and build performance.

- [**Directive Scanning and Module Resolution**](./directiveScanningAndResolution.md)
  This document details the internal `esbuild`-based scanner used to discover `"use client"` and `"use server"` directives, and the context-aware module resolution it employs to handle conditional exports correctly.

- [**React's Hoisting Behavior for `<link>`**](./reactHoisting.md)
  A brief explanation of a key React 19 feature that underpins our entire asset handling strategy. It details how React's ability to automatically move `<link>` tags to the document `<head>` allows for a clean and effective implementation of stylesheet and script preloading.

- [**Unified Script Discovery**](./unifiedScriptDiscovery.md)
  Discover the centralized mechanism for identifying every client-side JavaScript module required for a given page. This document explains how scripts are discovered from both static `Document` entry points and dynamically rendered components, providing a single source of truth for asset handling.

- [**Executing Worker Scripts**](./workerScripts.md)
  This document details the mechanism for running one-off scripts, such as database seeds, within the context of the application's worker environment.

- [**Smoke Testing Strategy for Package Manager Compatibility**](./smokeTestingStrategy.md)
  This document details the strategy for our smoke tests, which are designed to ensure the SDK functions correctly across various package managers and environments. It explains why we use a tarball-based testing approach instead of more common monorepo linking techniques.
