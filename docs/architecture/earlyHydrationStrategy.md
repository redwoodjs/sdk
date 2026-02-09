# Architecture: Early Hydration with Inline `import()`

This document explains the deliberate architectural strategy for loading the client-side entry point. The core of this strategy is the use of an inline `<script>import("...")</script>` tag in the user's `Document.tsx` instead of a standard `<script type="module" src="...">`.

This choice is fundamental to providing a responsive user experience in a streaming Server-Side Rendering (SSR) environment with React Suspense.

## The Challenge: Streaming, Suspense, and Delayed Interactivity

In a modern streaming architecture, the server sends an initial HTML "shell" immediately, allowing the user to see the page's layout and content long before all data has been fetched. Slower components are wrapped in `<Suspense>`, and their content is streamed in as it becomes ready.

This creates a significant challenge for script loading:

1.  **Module Scripts are Deferred:** By browser specification, a standard `<script type="module" src="...">` is a "deferred" script. It will not be executed until the *entire* HTML document has been downloaded and parsed.
2.  **Conflict with Streaming:** In a streaming context with `<Suspense>`, the closing `</body>` tag is not sent until the very last piece of suspended content has been streamed.
3.  **The User Experience Problem:** This combination means that if a page has a slow data fetch, the client-side JavaScript will not run until that fetch is complete. The user is left looking at a visible UI (e.g., buttons, menus from the initial shell) that is completely non-interactive, sometimes for several seconds. This negates the primary benefit of streaming.

As documented in historical pull requests ([#369](https://github.com/redwoodjs/sdk/pull/369)), this delayed hydration was a critical issue that needed to be solved.

## The Solution: Immediate Execution with Inline `import()`

To solve this, our framework adopts a different strategy. The user places an inline script in their `Document.tsx`:

```html
<script>import("/src/client.tsx")</script>
```

This approach has several key advantages:

1.  **Immediate Execution:** Unlike module scripts, inline scripts are executed by the browser the moment they are parsed. Because our framework ensures this script is placed after the main application shell (`<div id="hydrate-root">...</div>`), it runs as soon as the initial UI is present in the DOM.
2.  **Early Hydration:** This immediate execution means that `hydrateRoot` is called very early in the page load cycle. Client components in the initial shell become interactive almost instantly, even while other parts of the page are still streaming in.
3.  **Preserves Code Splitting:** By using a dynamic `import()`, we still get all the benefits of modern JavaScript, including code splitting. The browser starts fetching the entry point and its dependencies, but the execution of our client-side logic is not blocked by the entire document download.

This strategy provides the best of both worlds: we achieve the immediate interactivity required for a good streaming experience while retaining the performance benefits of ESM and code splitting.

For details on how this user-defined script tag is discovered at build time and transformed for production, see the [Document Component Transformations](./documentTransforms.md) and [Unified Script Discovery](./unifiedScriptDiscovery.md) architecture documents.
