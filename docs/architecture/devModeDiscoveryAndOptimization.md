# Dev Mode Discovery and Optimization

This document describes the challenges and solutions related to dependency discovery and optimization in the development environment. The core problem revolves around the tension between Vite's dependency pre-bundling feature (`optimizeDeps`) and the on-demand, dynamic nature of React Server Components (RSC).

## The Challenge: The SPA Dilemma vs. RSC Reality

Vite's `optimizeDeps` is a crucial performance feature. It addresses the "waterfall" problem inherent in native ES modules by scanning for dependencies in `node_modules` and pre-bundling them into single, larger JavaScript files. This is particularly effective for large libraries with many internal modules. The browser can then fetch one large, optimized chunk in parallel, rather than making hundreds of sequential requests. This pre-bundling is also cached, making subsequent server starts much faster.

This model works perfectly for a traditional Single-Page Application (SPA), where the bundler can often determine most of the necessary dependencies by statically analyzing the application's entry point.

However, our architecture presents a different challenge. Due to the nature of RSCs, components with a `"use client"` directive are not part of the initial server bundle. They are fetched on-demand by the browser as the user navigates and interacts with the application. This means we cannot know at startup which client components from a large library (like Mantine, where nearly every component is a client component) will actually be used.

A naive implementation that dynamically imports each client component as needed (`import('/path/to/node_modules/.../Button.mjs')`) completely bypasses Vite's `optimizeDeps` feature. The dev server sees these as requests for raw source files, leading to the exact "request waterfall" problem that `optimizeDeps` was designed to solve, resulting in a slow and frustrating developer experience.

## The Solution: "Just-in-Time" Discovery via Esbuild Plugin

The key to solving this problem lies in understanding the Vite lifecycle. While Vite's main plugin pipeline has a strict separation between dependency scanning and code transformation, the `esbuild` instance that `optimizeDeps` uses internally provides a powerful seam: `esbuild` plugins.

Our `directivesPlugin` adds an `esbuild` plugin that hooks into the `onLoad` callback. This callback is executed for *every* file that Vite's dependency scanner processes, including files deep within `node_modules`. This allows us to perform "just-in-time" discovery.

The process is as follows:

1.  **"Side-Effect" Discovery:** As Vite's optimizer scans the application's true entry points (e.g., `src/client.tsx`), our esbuild `onLoad` hook inspects every traversed module. When it encounters a file with a `"use client"` directive, it adds that file's path to a shared `clientFiles` set as a side effect.

2.  **Delayed Virtual Entry Point:** We add a special, virtual module to the *end* of the `optimizeDeps.entries` list. This is a critical detail. Because it is last, Vite's scanner processes all the application's real code first, giving our `onLoad` hook the opportunity to discover all the necessary `node_modules` dependencies and populate the `clientFiles` set.

3.  **Dynamic Bundle Generation:** By the time `esbuild` is ready to process our virtual entry point, the `clientFiles` set is fully populated. The `load` hook for this virtual module reads the set and generates its content on the fly: a list of `export * from '...'` statements for every dependency file that was discovered.

4.  **A Single, Comprehensive Bundle:** Vite's optimizer then takes this dynamically generated entry point and bundles all the re-exported client components into a single, comprehensive chunk. Because this process uses absolute file paths, it correctly bypasses any `exports` map restrictions in a package's `package.json`.

5.  **The Final Lookup:** The main `virtual:use-client-lookup` module can then `import *` from this custom-built bundle. The resulting module namespace acts as a complete "module registry" of all dependency client components, allowing for instant, synchronous resolution at runtime without any network waterfalls.

This approach is surgical and efficient. It avoids any slow, manual scanning of `node_modules` by leveraging Vite's own highly-optimized scanner to do the discovery work for us.
