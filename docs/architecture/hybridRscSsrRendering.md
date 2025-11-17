# Hybrid Rendering with Stream Stitching

This document outlines the hybrid rendering strategy used by the framework, combining React Server Components (RSC) and traditional Server-Side Rendering (SSR) to deliver a fast, interactive, and SEO-friendly user experience.

## The Core Challenges

A modern web framework must solve several competing challenges to provide a robust and intuitive platform:

1.  **Serving Multiple Request Types:** The architecture must handle fundamentally different request types from a single pipeline. An initial page load requires a full, server-rendered HTML document for SEO and fast perceived performance. Subsequent client-side navigations and server actions, however, are best served by a lightweight RSC data stream to create a seamless single-page application experience.

2.  **Managing Multiple Runtimes:** The framework uses two distinct React runtimes on the server: an RSC-compatible runtime (which respects the `"react-server"` export condition) and a traditional SSR runtime. The build and runtime systems must be able to use both within a single request, loading the correct version of React and its dependencies for each phase of rendering. This is managed by the [SSR Bridge](./ssrBridge.md).

3.  **Ensuring Deterministic Hydration:** For React's hydration to succeed, the component tree rendered on the server must be identical to the one rendered on the client. A single, nested server render pass can cause the outer document shell to interfere with the rendering context of the inner application. This can "pollute" shared state, like the internal counter for the `React.useId` hook, leading to an unavoidable mismatch between the server-generated HTML and the client's render tree.

4.  **Enabling Non-Blocking Hydration:** A primary benefit of streaming SSR with Suspense is "early hydration"—making the initial UI shell interactive before all data has been loaded. This requires the client-side JavaScript to be delivered and executed as soon as the initial shell is rendered, without waiting for the server to finish streaming all suspended content. The rendering architecture must be able to interleave the document and application streams to ensure the hydration script is not blocked by slow data fetches.

5.  **Providing an Intuitive Developer Experience:** High-level abstractions should behave as developers expect. If the framework's API for defining the main `Document` shell looks and feels like a Server Component, it should have the full capabilities of one, including the ability to `await` data and use other server-only APIs. A leaky abstraction that prevents this creates confusion and limits functionality.

## The Build-Time Foundation: Client References

The rendering process begins at build time. A Vite plugin scans for any file containing the `"use client"` directive. When found, the file's contents are replaced with "Client References." Each export from the original file becomes a reference object containing the module's path and the export name.

This transformation is key: it allows the server to render a component tree as a pure data structure (an RSC payload) that contains lightweight placeholders for client components, without needing to execute the client components' code in the RSC runtime.

## The Runtime Solution: Isolate, Render, and Stitch

The runtime architecture is designed to handle different scenarios, from the initial page load to subsequent client interactions.

### Scenario 1: Initial Page Load

For the first request to a page, the goal is to deliver a complete, streaming HTML document. This is achieved through two parallel rendering pipelines followed by a composition step.

#### Pipeline A: The Application Render

This pipeline generates both the server-rendered HTML for the application and the RSC payload needed for client-side hydration.

1.  **RSC Render:** The application's main page component is rendered as a tree of Server Components. This produces an RSC payload stream containing the UI's data and structure, including the Client References for any interactive components.
2.  **Stream Forking:** This RSC payload stream is forked into two branches: one for the server's use, and one destined for the client.
3.  **Server-Side Hydration & SSR:** The server's branch of the RSC payload is consumed by the SSR runtime. This process is analogous to client-side hydration: the SSR engine reconstructs the React element tree from the RSC data. When it encounters a Client Reference, it uses the information in the reference to load the actual client component's code and execute it, generating its HTML output. The result is a fully-rendered HTML stream for the application.

#### Pipeline B: The Document Shell Render

In parallel, the document shell is rendered in its own isolated context.

1.  **True Server Component `Document`**: The user-defined `<Document>` is rendered as a true Server Component, allowing developers to use `async/await` and other server-only features.
2.  **RSC and SSR Render**: The `<Document>` component is also rendered through the same two-phase RSC-then-SSR process to produce a complete HTML stream for the document shell, containing a unique placeholder for the application content.

#### Final Composition: Advanced Stream Stitching

The final step is to combine the document and application HTML streams into a single, valid HTML response. This process must solve two critical challenges:

1.  **Non-Blocking Hydration:** A `<Suspense>` boundary in the application could pause its HTML stream. A naive stitching approach would block the rest of the document, including the client-side `<script>` tags, from being sent, defeating the purpose of streaming.
2.  **Meta Tag Hoisting:** React components can declare `<title>` and `<meta>` tags. React correctly hoists these to the beginning of the application's HTML stream. However, by the time this stream is processed, the document's `<head>` has often already been sent to the browser, causing the tags to be incorrectly placed in the `<body>`.

To solve both, the framework uses a multi-phase stream interleaving strategy, orchestrated by a dedicated utility.

**1. Application Stream Pre-processing**

Before stitching begins, the application HTML stream is pre-processed. The utility reads from the start of the stream to isolate the block of hoisted tags (`<title>`, `<meta>`, etc.) that React places at the beginning. The stream is effectively split into two new virtual streams: one containing only the hoisted tags, and a second containing the rest of the application body.

**2. Multi-Phase Interleaving**

The utility then proceeds through a series of phases to construct the final HTML:

*   **Phase 1: Stream Document Head & Inject Hoisted Tags:** The process begins by streaming the document shell. It reads until it finds the closing `</head>` tag. It sends the document content *up to* that point, then injects the complete block of hoisted tags, and finally sends the `</head>` tag. This ensures all meta tags are correctly placed within the head, after any content defined in the server-side `Document` component.

*   **Phase 2: Stream Remainder of Document up to App Marker:** The process continues reading the document stream until it finds the application start marker (`<div id="rwsdk-app-start" />`). This part of the document typically contains the opening `<body>` tag. The marker itself is discarded.

*   **Phase 3: Stream Initial App Shell:** The process switches to the application body stream and sends chunks until it finds the end marker (`<div id="rwsdk-app-end" />`). This represents the complete, non-suspended UI. This marker is left in the stream to ensure the client-side render tree matches the server-rendered DOM structure, preventing hydration errors.

*   **Phase 4: Stream Document Body Tail:** The process switches back to the document stream to send the remainder of the body. This is a critical step, as this section contains the client-side `<script>` tag that initiates hydration.

*   **Phase 5: Stream Suspended Content:** The process switches back to the application body stream for the final time and sends all remaining chunks. This is the content from any `<Suspense>` boundaries that have now resolved on the server.

*   **Phase 6: Finish Document:** Finally, the process returns to the document stream to send any remaining content, typically the closing `</body>` and `</html>` tags.

This precise interleaving process guarantees that the doctype is sent first, hoisted tags are correctly placed in the head, and the browser receives the static HTML and the script needed to make it interactive as quickly as possible, fulfilling the promise of a non-blocking, SEO-friendly, streaming-first architecture.

#### Client-Side Hydration

The client-side process remains the same:

1.  **Stream Stitching**: A utility merges the two HTML streams. It streams the document shell until it finds the placeholder, then injects the application's HTML stream. This process is fully streamed, ensuring a fast time-to-first-byte.
2.  **RSC Payload Injection**: The client's branch of the RSC payload is injected into the final stitched stream inside inline `<script>` tags.
3.  **Client Hydration**: In the browser, the static HTML is rendered immediately. The client-side runtime consumes the injected RSC payload. When it encounters a Client Reference, it dynamically fetches the component's JavaScript module and uses it to hydrate the server-rendered HTML, making the application interactive.

### Scenario 2: Client Interactions & Server Actions

Once the page is hydrated, subsequent interactions are handled more efficiently.

1.  **Action Call**: An event handler in a Client Component calls a Server Action.
2.  **Server Execution**: The request is sent to the worker. The action is executed, and then the application's page component is re-rendered to an RSC payload stream, reflecting any state changes.
3.  **Direct RSC Response**: This new RSC payload is sent directly back to the client as the response, bypassing the HTML rendering and stitching pipelines entirely.
4.  **Client Update**: The client-side runtime receives the new RSC payload (which includes the return value of the action) and uses it to seamlessly update the UI without a full page reload.
