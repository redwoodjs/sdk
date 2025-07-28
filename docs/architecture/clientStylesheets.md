# Supporting Client-Side Stylesheet Imports

This document outlines the architecture that enables developers to import stylesheets directly into "use client" components and have them automatically included in the final rendered HTML document, even when those components are loaded asynchronously as part of a React Server Components (RSC) stream.

## The Challenge: The Server-Side Rendering Race Condition

Our framework uses a server-rendered `Document` component, which gives developers full control over the HTML shell but bypasses Vite's standard `index.html`-based asset discovery. This creates a fundamental "chicken and egg" problem when dealing with stylesheets for client-side components, especially within a React Server Components (RSC) architecture.

The core challenges are:

1.  **The Ordering Problem:** To avoid a Flash of Unstyled Content (FOUC), `<link rel="stylesheet">` tags must be injected into the `<head>` of the HTML document. However, the decision to load a specific client component (and therefore its CSS) is made *during* the RSC stream rendering on the server. This happens long after the initial `<head>` has already been sent to the browser.

2.  **Dynamic and Asynchronous Discovery:** We do not know the full set of client components that will be rendered on a page upfront. They are discovered dynamically as the RSC payload is generated. This is true for the main client entry point and, more critically, for any client component "island" that is rendered asynchronously.

3.  **The Streaming Dilemma:** We cannot simply wait for the entire RSC stream to be processed on the server to collect all stylesheet dependencies before sending the HTML. Doing so would buffer the entire response, negating the primary benefits of streaming, such as a fast Time To First Byte (TTFB) and progressive page loading.

In short, we need a way to inject stylesheet links into the `<head>` of the document *as they are discovered on the server*, without blocking the stream, and in a way that aligns with React's rendering lifecycle. The initial approach of trying to find all stylesheets before rendering the `Document` is not viable in this dynamic, streaming environment.

### The Environment Mismatch: Worker vs. Node.js

Beyond the timing issue, a second fundamental challenge is the environment boundary between the Vite dev server and the worker runtime.

-   The Vite dev server runs in a Node.js process, with full access to the file system and Vite's internal module graphs.
-   The worker, however, runs in a restrictive sandbox environment (Cloudflare Workers or Miniflare locally) that intentionally lacks file system access and cannot directly interact with the Vite server's memory or internals.

This sandbox makes it impossible for the runtime code inside the worker to directly look up a module in the Vite dev server's graph or read a manifest file from the disk. Any solution must respect this boundary and establish a clean communication channel between the two environments.

## The Solution: A Virtual Module Bridge

The solution is a unified system that uses a **virtual module** to create a clean bridge between the Vite/Node.js environment and the worker sandbox. This approach solves both the timing problem and the environment mismatch by hooking into the RSC rendering lifecycle to discover stylesheet dependencies precisely when they are needed, using an environment-aware mechanism.

### 1. Central Hook: The RSC Renderer Integration

The core of this architecture is an integration with the React renderer itself. When React processes the RSC stream on the server, it needs to resolve the client components it encounters. We provide it with a custom function for this resolution (via `__webpack_require__`). This function serves as the perfect hook, as it is called by React at the exact moment a client component is identified, giving us its module ID.

### 2. On-Demand Stylesheet Discovery via a Virtual Module

To bridge the environment gap, we use a custom Vite plugin that provides a virtual module (e.g., `virtual:stylesheet-lookup`). When the worker needs to find stylesheets for a component, it imports a function from this virtual module. The plugin's `load` hook, which runs in the Node.js environment, is responsible for providing the code for this module.

This `load` hook is the core of the bridge. It generates a different implementation for the module depending on the context:

-   **In Development**: The plugin's `load` hook generates a module that exports a `findStylesheetsForEntryPoint` function. This generated function uses `fetch` to make a network request back to a special endpoint on the Vite dev server (e.g., `/__rws_stylesheets`). This endpoint, also exposed by our plugin, has access to the dev server instance and can perform the module graph traversal on behalf of the worker.

-   **In Production**: During a build, the plugin's `load` hook reads the `dist/client/.vite/manifest.json`. It then generates a module string that hardcodes the relevant parts of the manifest into the exported `findStylesheetsForEntryPoint` function. This allows the worker to perform the lookup at runtime using the embedded manifest data, with no need for file system access.

This approach cleanly separates concerns. All Node.js- and Vite-specific logic lives within the plugin, running in the Node.js environment. The worker runtime remains completely isolated in its sandbox, interacting with the system through a clean, well-defined API provided by the virtual module.

### 3. Injecting the Stylesheets via React Suspense

Discovered stylesheet URLs are collected in a request-scoped `Set` to prevent duplicates. The final injection is orchestrated by a component that uses React Suspense to wait for the RSC stream to be fully processed.

Here is a conceptual example of how it works inside our `renderRscThenableToHtmlStream` function:

```tsx
// Conceptual example of the rendering component
const RscApp = ({ thenable, requestInfo }) => {
  // 1. This hook suspends rendering until the entire RSC stream is processed.
  //    During suspension, our ssrWebpackRequire hook is called for each
  //    client component, populating `requestInfo.rw.discoveredStyleSheets`.
  const rscVDOM = use(thenable);

  // 2. This code only runs AFTER the `thenable` has resolved, meaning
  //    discovery is complete.
  const discoveredStyles = [...requestInfo.rw.discoveredStyleSheets];

  // 3. Render the collected <link> tags. React hoists them to the <head>.
  return (
    <>
      {discoveredStyles.map(href => <link key={href} rel="stylesheet" href={href} />)}
      <div id="hydrate-root">{rscVDOM.node}</div>
    </>
  );
};
```

This pattern elegantly solves the timing problem. We don't need to know when the stream is "done"; React tells us by resolving the `thenable`.

We then rely on a standard behavior of React's streaming renderer. As documented on [react.dev](https://react.dev/reference/react-dom/components/link#special-rendering-behavior), React automatically detects `<link>` components rendered anywhere in the tree and ensures they are hoisted into the document's `<head>` in the final HTML stream. This allows us to inject links as they are discovered without blocking the stream, preventing any Flash of Unstyled Content (FOUC).