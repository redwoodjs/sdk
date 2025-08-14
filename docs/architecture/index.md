# Architecture Documents

This directory contains documents that explain the core architectural concepts of the RedwoodJS framework. Each document provides insight into the challenges we faced and the solutions we implemented.


### [The SSR Bridge](./ssrBridge.md)

Introduces the "SSR Bridge," a mechanism that allows the framework to use two different Vite environments (`worker` for RSC and `ssr` for traditional SSR) within a single Cloudflare Worker, resolving conflicting dependency requirements.

### [Client-Side Stylesheet Imports](./clientStylesheets.md)

Covers the end-to-end process for supporting CSS imports within "use client" components, including how styles are discovered during server rendering and how a "Flash of Unstyled Content" (FOUC) is prevented in production.

### [Document Component Transformations](./documentTransforms.md)

Details the automated transformations applied to `Document` components. These modifications handle development-time paths, inject stylesheet links, and add security nonces to script tags.

### [Preloading Client-Side Scripts](./preloading.md)

Explains the strategy for improving page-load performance by preloading client-side JavaScript modules. This process flattens the request waterfall by providing the browser with early resource hints.

### [React's Hoisting Behavior for `<link>`](./reactHoisting.md)

Outlines a key React feature that is fundamental to our asset-handling strategy: the automatic hoisting of `<link>` elements to the document's `<head>`.

### [Unified Script Discovery](./unifiedScriptDiscovery.md)

Describes the central process for collecting all client-side script dependencies during a server-side render. It details how scripts are discovered from both static `Document` entry points and dynamically loaded components.
