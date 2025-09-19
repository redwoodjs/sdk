# Hybrid Rendering Pipeline for RSC and SSR

This document outlines the hybrid rendering strategy used by the framework. The primary goal is to combine the benefits of React Server Components (RSC) with traditional Server-Side Rendering (SSR) to deliver a fast, interactive, and SEO-friendly user experience for initial page loads, while enabling efficient updates for subsequent user interactions.

## The Challenge: Merging Two Rendering Paradigms

A modern web application framework must balance competing priorities:

1.  **Fast Initial Loads:** The user should see a complete, server-rendered HTML page as quickly as possible for good performance and SEO.
2.  **Rich Interactivity:** The application should feel fast and responsive after the initial load, avoiding full-page reloads for navigation and actions.
3.  **Efficient Data Handling:** The framework should leverage the RSC model of co-locating components with their data dependencies on the server.

The challenge is that these scenarios are best served by different rendering outputs. An initial load requires HTML, while subsequent interactions are most efficiently handled by a more lightweight data format that the client can use to update the UI. The architecture must seamlessly handle both cases.

## The Solution: A Unified Pipeline with Two Outputs

The solution is a unified rendering pipeline that always begins with an RSC render but produces two different final outputs depending on the type of request: a full HTML document for initial loads, and a raw RSC payload stream for client interactions.

The RSC payload is the fundamental unit of communication. The initial HTML document is best understood as a vehicle for delivering the *first* RSC payload to the browser, bootstrapped within a server-rendered shell.

The entire process is orchestrated within the worker's `renderPage` function, which distinguishes between an initial load request and a client-driven RSC request.

### Scenario 1: Initial Page Load

For a user's first visit to a page, the goal is to deliver a complete HTML document. This is accomplished with a two-stage process.

#### Stage 1: Rendering to an RSC Payload Stream

The first stage is a pure RSC render.

1.  **Component Tree Input:** The process begins with the matched page's root component.
2.  **RSC Render:** This component tree is passed to React's RSC renderer (`renderToRscStream`).
3.  **RSC Payload Output:** The output is not HTML, but a `ReadableStream` known as the "RSC Payload." This stream is a serialized representation of the component tree, including rendered server components, data, and special placeholders for client components that need to be hydrated in the browser.

This initial render fulfills the goals of the RSC paradigm: components are rendered on the server, close to their data sources.

#### Stage 2: Server-Side Rendering the RSC Payload to HTML

The RSC payload is not useful to a browser on its own for an initial load; it needs to be converted into a standard HTML document. This is the second stage of the pipeline.

1.  **Passing the Payload:** The RSC payload stream from Stage 1 is passed to a second rendering function, `transformRscToHtmlStream`.
2.  **Consuming the Payload:** Inside this function, a temporary React component (`RscApp`) consumes the stream using the `React.use()` hook. This effectively reconstructs the React component tree on the server from the serialized RSC payload.
3.  **SSR Render:** This reconstructed tree, which now includes the server-rendered output of client components, is wrapped in the user's custom `<Document>` component. The entire structure is then passed to React's traditional SSR renderer (`renderToReadableStream` from `react-dom/server.edge`).
4.  **HTML Stream Output:** The output of this stage is a `ReadableStream` of the final HTML document.

#### Final Assembly: Injecting the Payload for Hydration

To enable client-side hydration and subsequent navigations, the final HTML document must also contain the original RSC payload.

To facilitate this, the RSC payload stream from Stage 1 is `tee()`d. While one branch goes to the SSR renderer (Stage 2), the other is piped through a utility (`injectRSCPayload`) that transforms it into a series of inline `<script>` tags. These tags are streamed into the final HTML response, making the payload available to the client.

### Scenario 2: Client Interactions and Navigations

Once the application is hydrated on the client, all subsequent navigations and server action calls are handled much more simply. These requests are identified by the `accept: text/x-component` header or the `__rsc` search parameter.

In this scenario, the pipeline executes only Stage 1:

1.  **Execute Action (if any):** If the request is for a server action, the action is executed first.
2.  **RSC Render:** The component tree is re-rendered into a new RSC payload stream via `renderToRscStream`.
3.  **Direct Response:** This RSC payload stream is returned directly to the client with a `Content-Type` of `text/x-component`. There is no Stage 2 SSR render to HTML.

The client-side runtime receives this new payload and uses it to reconcile the DOM, updating the UI efficiently without a full page reload. This model preserves the speed and feel of a single-page application while leveraging the power of server-side rendering.
