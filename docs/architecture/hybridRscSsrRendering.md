# Hybrid Rendering with Stream Stitching

This document outlines the hybrid rendering strategy used by the framework, combining React Server Components (RSC) and traditional Server-Side Rendering (SSR) to deliver a fast, interactive, and SEO-friendly user experience.

## The Core Challenges

A modern web framework must solve several competing challenges to provide a robust and intuitive platform:

1.  **Serving Multiple Request Types:** The architecture must handle fundamentally different request types from a single pipeline. An initial page load requires a full, server-rendered HTML document for SEO and fast perceived performance. Subsequent client-side navigations and server actions, however, are best served by a lightweight RSC data stream to create a seamless single-page application experience.

2.  **Managing Multiple Runtimes:** The framework uses two distinct React runtimes on the server: an RSC-compatible runtime (which respects the `"react-server"` export condition) and a traditional SSR runtime. The build and runtime systems must be able to use both within a single request, loading the correct version of React and its dependencies for each phase of rendering. This is managed by the [SSR Bridge](./ssrBridge.md).

3.  **Ensuring Deterministic Hydration:** For React's hydration to succeed, the component tree rendered on the server must be identical to the one rendered on the client. A single, nested server render pass can cause the outer document shell to interfere with the rendering context of the inner application. This can "pollute" shared state, like the internal counter for the `React.useId` hook, leading to an unavoidable mismatch between the server-generated HTML and the client's render tree.

4.  **Providing an Intuitive Developer Experience:** High-level abstractions should behave as developers expect. If the framework's API for defining the main `Document` shell looks and feels like a Server Component, it should have the full capabilities of one, including the ability to `await` data and use other server-only APIs. A leaky abstraction that prevents this creates confusion and limits functionality.

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

#### Final Composition & Client-Side Hydration

The outputs are combined to form the final response:

1.  **Stream Stitching**: A utility merges the two HTML streams. It streams the document shell until it finds the placeholder, then injects the application's HTML stream. This process is fully streamed, ensuring a fast time-to-first-byte.
2.  **RSC Payload Injection**: The client's branch of the RSC payload is injected into the final stitched stream inside inline `<script>` tags.
3.  **Client Hydration**: In the browser, the static HTML is rendered immediately. The client-side runtime consumes the injected RSC payload. When it encounters a Client Reference, it dynamically fetches the component's JavaScript module and uses it to hydrate the server-rendered HTML, making the application interactive.

### Scenario 2: Client Interactions & Server Actions

Once the page is hydrated, subsequent interactions are handled more efficiently.

1.  **Action Call**: An event handler in a Client Component calls a Server Action.
2.  **Server Execution**: The request is sent to the worker. The action is executed, and then the application's page component is re-rendered to an RSC payload stream, reflecting any state changes.
3.  **Direct RSC Response**: This new RSC payload is sent directly back to the client as the response, bypassing the HTML rendering and stitching pipelines entirely.
4.  **Client Update**: The client-side runtime receives the new RSC payload (which includes the return value of the action) and uses it to seamlessly update the UI without a full page reload.
