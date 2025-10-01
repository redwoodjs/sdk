# RedwoodSDK architecture documentation 

This collection of documents provides a high-level overview of the core architectural concepts and mechanisms within the RedwoodSDK. They are intended to explain the "why" behind key design decisions, focusing on the problems encountered and the solutions implemented.

- [**Hybrid Rendering with Stream Stitching**](./hybridRscSsrRendering.md)
  Outlines the hybrid rendering strategy combining React Server Components (RSC) and traditional Server-Side Rendering (SSR). It details how two parallel rendering pipelines are used to generate HTML for the application and the document shell, which are then combined using a Suspense-aware stream stitching process.

- [**Unified Request Handling**](./requestHandling.md)
  Describes the ordered, short-circuiting loop for processing all incoming requests, ensuring that global middleware, RSC actions, and page routes are handled in the correct sequence.

- [**The SSR Bridge**](./ssrBridge.md)
  Details the architecture that allows the framework to support two different rendering environments (RSC and traditional SSR) within a single Cloudflare Worker. It explains how the "SSR Bridge" uses Vite's Environments API to manage conflicting dependency requirements between the two runtimes.

- [**Directive Scanning and Module Resolution**](./directiveScanningAndResolution.md)
  Details the internal `esbuild`-based scanner used to discover `"use client"` and `"use server"` directives, and the context-aware module resolution it employs to handle conditional exports correctly.

- [**Directive Transformations**](./directiveTransforms.md)
  Explains how modules containing `"use client"` and `"use server"` directives are transformed. It covers how "use client" modules are handled differently for RSC and SSR, and how "use server" modules are converted into secure RPC proxies.

- [**Document Component Transformations**](./documentTransforms.md)
  Covers the automated source code transformations applied to the main `Document.tsx` component. This includes rewriting asset paths for production, injecting security nonces, and discovering client-side entry points.

- [**Early Hydration with Inline `import()`**](./earlyHydrationStrategy.md)
  Explains the use of an inline `<script>import("...")</script>` tag to load the client-side entry point. This strategy enables "early hydration," making the UI interactive before the entire page has finished streaming.

- [**Unified Script Discovery**](./unifiedScriptDiscovery.md)
  Explains the centralized mechanism for identifying every client-side JavaScript module required for a given page. It details how scripts are discovered from both static `Document` entry points and dynamically rendered components.

- [**Supporting Client-Side Stylesheet Imports**](./clientStylesheets.md)
  Explains how the framework handles CSS imports within "use client" components to prevent a "Flash of Unstyled Content" (FOUC) in production, using the unified script discovery mechanism.

- [**Preloading Client-Side Scripts**](./preloading.md)
  Describes the strategy for improving page load performance by preloading client-side JavaScript modules. It explains how the server uses the discovered script list to send resource hints to the browser.

- [**The Production Build Process**](./productionBuildProcess.md)
  Outlines the multi-phase build process for production environments, orchestrating interdependent Vite builds to create an optimized and correctly linked worker.

- [**Dev Server Dependency Optimization**](./devServerDependencyOptimization.md)
  Outlines the strategy used to manage dependencies in the development server, providing Vite's dependency optimizer with a complete dependency graph at startup to improve performance and stability.

- [**E2E Testing Infrastructure**](./endToEndTesting.md)
  Outlines the architecture of the end-to-end testing infrastructure, designed for fast and reliable testing of playground applications using a concurrent, suite-level approach.

- [**SDK, Starter, and Addon Release Process**](./releaseProcess.md)
  Outlines the comprehensive versioning, testing, and release strategy for the SDK ecosystem, detailing the automated process for publishing `rwsdk`, `starter`, and `addon` artifacts.

- [**Client-Side Navigation**](./clientSideNavigation.md)
  An explanation of how client-side navigation works in RedwoodSDK, providing a Single Page App (SPA) like experience.
