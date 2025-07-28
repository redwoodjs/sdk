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

## The Solution: A Unified Runtime Injection Model

The solution is a two-phase discovery process that feeds a single, unified runtime injection mechanism. It uses a Vite plugin to collect information at build-time and a virtual module to expose that information to the runtime, ensuring all `<link>` tags are injected in one place, at the right time. This avoids the complexity and brittleness of having a build-time plugin directly manipulate the `Document`'s JSX.

### Phase 1 (Build-Time): Entry Point Mapping

The first phase solves the problem of discovering the static client entry point (e.g., `<script src="/src/client.tsx">`) without giving the build-time plugin the messy job of injecting code.

Our `transformJsxScriptTagsPlugin` is simplified to a "mapper". Its only responsibility is to:
1.  Scan `Document.tsx` files for `<script>` tags that point to client entry points.
2.  Generate a mapping: `{ 'path/to/Document.tsx': ['/src/client.tsx'] }`.
3.  This mapping is then made available to our `virtual:stylesheet-lookup` plugin.

### Phase 2 (Runtime): Two-Stage Stylesheet Discovery

At runtime, the worker uses the `virtual:stylesheet-lookup` module to discover all necessary CSS. To manage this process, the framework creates a temporary context object for each incoming HTTP request. This object holds data relevant only to that single request, ensuring that state is properly isolated between concurrent users. A `Set<string>` named `discoveredStyleSheets` is attached to this context to collect all unique stylesheet URLs as they are found.

This collection process happens in two stages:

1.  **Initial Stylesheet Lookup:** Before the RSC render stream begins, the worker identifies the `Document` component being used for the current request. It calls a function like `getInitialStylesheets(documentModuleId)` from the virtual module. The virtual module uses the pre-computed map from Phase 1 to find the static entry points and their corresponding CSS. These are added to the per-request `discoveredStyleSheets` set.

2.  **Dynamic Stylesheet Lookup (RSC Islands):** As the RSC stream renders, our `__webpack_require__` hook is called for any dynamically loaded client components. This hook *also* calls a function on the virtual module to find the stylesheets for that specific component island. These are also added to the same per-request `discoveredStyleSheets` set.

### Phase 3 (Runtime): Unified Injection via React Suspense

This is the final, unified step. The component that wraps the RSC stream (`RscApp` in our conceptual example) works exactly as before. It uses React Suspense (`use(thenable)`) to wait for the entire stream to be processed. Once resolved, it takes the **complete** set of stylesheets—both initial and dynamic—from the per-request `discoveredStyleSheets` set and renders them as `<link>` tags.

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

This pattern solves the timing problem. We don't need to know when the stream is "done"; React tells us by resolving the `thenable`.

We then rely on a standard behavior of React's streaming renderer. As documented on [react.dev](https://react.dev/reference/react-dom/components/link#special-rendering-behavior), React automatically detects `<link>` components rendered anywhere in the tree and ensures they are hoisted into the document's `<head>` in the final HTML stream. This allows us to inject links as they are discovered without blocking the stream, preventing any Flash of Unstyled Content (FOUC).

This architecture is superior because it:
-   **Decouples Discovery from Injection:** The transform plugin only discovers entry points; it doesn't inject `<link>` tags.
-   **Centralizes Injection Logic:** All `<link>` tags are created and rendered in one place, making the process predictable and easier to debug.
-   **Maintains Environment Boundaries:** The virtual module continues to act as a clean bridge between the Vite/Node.js environment and the worker sandbox.