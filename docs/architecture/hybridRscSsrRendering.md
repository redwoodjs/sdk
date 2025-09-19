# RSC-First Hybrid Rendering

This document outlines the hybrid rendering strategy used by the framework. The primary goal is to combine the benefits of React Server Components (RSC) with traditional Server-Side Rendering (SSR) to deliver a fast, interactive, and SEO-friendly user experience.

## The Challenge: Merging Two Rendering Paradigms

A modern web application framework must balance competing priorities:

1.  **Fast Initial Loads:** The user should see a complete, server-rendered HTML page as quickly as possible for good performance and SEO.
2.  **Rich Interactivity:** The application should feel fast and responsive after the initial load, avoiding full-page reloads for navigation and actions.
3.  **Efficient Data Handling:** The framework should leverage the RSC model of co-locating components with their data dependencies on the server.

The core challenge is that an initial page load requires a full HTML document, while subsequent client-side navigations and actions are most efficiently handled by a lightweight RSC data stream. The architecture must produce the correct output for each case from a single, unified rendering pipeline.

## The Solution: A Unified, RSC-First Pipeline

The solution is a unified, "RSC-first" rendering pipeline. For every request, the process begins by creating a single React element tree that is rendered to an RSC stream. The structure of that tree, and what happens to the stream, depends on the type of request.

The entire process is orchestrated within the worker, which distinguishes between an initial load and a subsequent client-driven RSC request.

### Scenario 1: Initial Page Load

For a user's first visit to a page, the goal is to deliver a complete, server-rendered HTML document.

#### Stage 1: Assembling the Full Page in RSC

Unlike a traditional SSR-wrapped approach, the entire page—including the `<html>`, `<head>`, and `<body>` tags—is first assembled as a tree of Server Components.

1.  **Component Tree Input:** The process begins with the matched page's root component (e.g., `<UsersPage>`).
2.  **Document Wrapping:** This page component is then wrapped in a higher-order Server Component, `<Document>`, which provides the surrounding HTML shell, including stylesheets, preload links, and necessary bootstrap scripts.
3.  **RSC Render:** This complete tree (`<Document><UsersPage/></Document>`) is passed to React's RSC renderer (`renderToRscStream`).
4.  **RSC Payload Output:** The output is a `ReadableStream` containing the serialized representation of the entire page, including placeholders for any Client Components that need to be rendered in the next stage.

#### Stage 2: Transforming the RSC Payload to an HTML Stream

The RSC payload, which now represents the full document, is then transformed into a standard HTML stream. This stage is responsible for server-rendering any Client Components embedded in the tree.

1.  **Consuming the Payload:** The RSC payload stream from Stage 1 is consumed by a temporary React component using the `React.use()` hook. This reconstructs the full React component tree on the server.
2.  **SSR Render:** This reconstructed tree is passed directly to React's traditional SSR renderer (`renderToReadableStream` from `react-dom/server.edge`). As the renderer walks the tree, it generates HTML. When it encounters a placeholder for a Client Component, it server-renders that component and its output is embedded in the HTML stream.
3.  **HTML Stream Output:** The final output is a `ReadableStream` of the complete HTML document.

This RSC-first approach ensures that there is a single, unified component tree. This is critical for features like React's `useId` hook, which relies on a consistent rendering path between the server and the client to avoid hydration mismatches.

### Scenario 2: Client Interactions and Navigations

Once the application is hydrated on the client, all subsequent navigations and server action calls are handled more simply.

In this scenario, the pipeline executes only Stage 1, but with a different component tree:

1.  **Component Tree Input:** The process begins with just the page component (e.g., `<UsersPage>`), *without* the `<Document>` wrapper.
2.  **RSC Render:** This component tree is rendered into a new RSC payload stream via `renderToRscStream`.
3.  **Direct Response:** This RSC payload stream is returned directly to the client with a `Content-Type` of `text/x-component`. There is no Stage 2 transformation to HTML.

The client-side runtime receives this new payload and uses it to update the UI, preserving the speed and feel of a single-page application.
