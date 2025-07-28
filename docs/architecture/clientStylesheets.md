# Supporting Client-Side Stylesheet Imports

This document outlines the architecture that enables developers to import stylesheets directly into "use client" components and have them automatically included in the final rendered HTML document, even when those components are loaded asynchronously as part of a React Server Components (RSC) stream.

## The Challenge: The Server-Side Rendering Race Condition

Our framework uses a server-rendered `Document` component, which gives developers full control over the HTML shell but bypasses Vite's standard `index.html`-based asset discovery. This creates a fundamental "chicken and egg" problem when dealing with stylesheets for client-side components, especially within a React Server Components (RSC) architecture.

The core challenges are:

1.  **The Ordering Problem:** To avoid a Flash of Unstyled Content (FOUC), `<link rel="stylesheet">` tags must be injected into the `<head>` of the HTML document. However, the decision to load a specific client component (and therefore its CSS) is made *during* the RSC stream rendering on the server. This happens long after the initial `<head>` has already been sent to the browser.

2.  **Dynamic and Asynchronous Discovery:** We do not know the full set of client components that will be rendered on a page upfront. They are discovered dynamically as the RSC payload is generated. This is true for the main client entry point and, more critically, for any client component "island" that is rendered asynchronously.

3.  **The Streaming Dilemma:** We cannot simply wait for the entire RSC stream to be processed on the server to collect all stylesheet dependencies before sending the HTML. Doing so would buffer the entire response, negating the primary benefits of streaming, such as a fast Time To First Byte (TTFB) and progressive page loading.

In short, we need a way to inject stylesheet links into the `<head>` of the document *as they are discovered on the server*, without blocking the stream, and in a way that aligns with React's rendering lifecycle. The initial approach of trying to find all stylesheets before rendering the `Document` is not viable in this dynamic, streaming environment.

## The Solution: Dynamic, Renderer-Aware Stylesheet Injection

The solution is a unified system that hooks into the RSC rendering lifecycle to discover stylesheet dependencies precisely when they are needed. This approach abandons a static, pre-built lookup map in favor of on-demand discovery and leverages React's streaming and Suspense capabilities to avoid blocking the render.

### 1. Central Hook: The RSC Renderer Integration

The core of this architecture is an integration with the React renderer itself. When React processes the RSC stream on the server, it needs to resolve the client components it encounters. We provide it with a custom function for this resolution (via `__webpack_require__`). This function serves as the perfect hook, as it is called by React at the exact moment a client component is identified, giving us its module ID.

### 2. On-Demand Stylesheet Discovery

A single, unified utility is responsible for finding all stylesheet dependencies for a given JavaScript module ID. It operates in two modes:

-   **In Production**: For builds, the utility consults the Vite build manifest (`manifest.json`). This manifest contains a definitive mapping of every client component entry point to its final, bundled CSS files. This lookup is fast and efficient.
-   **In Development**: During development, a module's dependency graph may not yet exist in Vite's module graph when our hook is called. To solve this, we use the Vite Dev Server API directly. By calling `viteDevServer.transformRequest(moduleId)`, we instruct Vite to process the file immediately. This populates its module graph for that specific component and all of its imports. We can then traverse this newly-available graph to find all imported stylesheets.

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