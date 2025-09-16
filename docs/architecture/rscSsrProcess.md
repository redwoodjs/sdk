# Architecture: RSC to HTML Rendering

This document outlines the process of transforming a React Server Components (RSC) render into a final HTML document suitable for an initial page load.

## The Challenge: Bridging Two Runtimes

The framework's architecture involves rendering React Server Components (RSC) and then using a traditional Server-Side Render (SSR) to generate the final HTML. Both of these operations must occur within the same Cloudflare Worker, but they have conflicting dependency requirements.

The RSC and SSR runtimes require different builds of React and its dependencies. This is typically managed by a `package.json` conditional export called `"react-server"`. An RSC-compatible build uses packages that respect this condition, while a standard SSR build does not. A single Vite environment cannot be configured to handle both sets of dependency requirements simultaneously, creating a bundling challenge that must be solved at build time.

## The Solution: A Two-Phase Render via SSR Bridge

The solution is a two-phase process that leverages two separate Vite environments—`worker` for RSC and `ssr` for traditional SSR—connected by a mechanism called the **SSR Bridge**.

### Phase 1: Render to RSC Payload

The first phase is a standard RSC render that occurs entirely within the `worker` environment. The application's component tree is rendered into the RSC payload format, which is a serialized representation of the UI with placeholders for any Client Components.

### Phase 2: SSR Render from the RSC Payload

The second phase takes the RSC payload from Phase 1 and renders it to an HTML stream. This step is conceptually similar to how a client browser would process the payload, but it runs on the server.

This is where the SSR Bridge comes in. The `worker` environment passes the RSC payload to the `ssr` environment through the bridge. The `ssr` environment, which is configured with a standard React runtime, then parses the payload. When it encounters a Client Component placeholder, it loads the component's code and renders it to HTML using a traditional server-side React DOM renderer.

#### The Hydration Synchronization Challenge

A significant challenge in this process is ensuring correct client-side hydration, especially for hooks like `React.useId` that require a consistent state between the server and client. This synchronization relies on a `resumableState` object, which contains data like the `useId` seed, that must be generated on the server and passed to the client.

This presents a conflict between React's design and the framework's philosophy:

1.  **React's Expectation:** The `renderToReadableStream` function is designed to control the entire HTML shell. It only generates the `resumableState` when it is responsible for rendering the `<html>`, `<head>`, and `<body>` tags itself.
2.  **Framework Philosophy:** A core principle of the framework is that the user must have full, transparent control over the document shell via a `Document.tsx` component.

Simply passing the user's `Document` to React's renderer would prevent the `resumableState` from ever being generated, causing hydration to fail.

#### The Two-Pass Render Solution

To resolve this, the framework employs a two-pass rendering strategy that satisfies both requirements.

**Pass 1: Generate Hydration State & App Content.** First, React's renderer is called with *only* the application's core content. This allows React to render the app inside a minimal `<html>` shell and, critically, inject the necessary preamble containing `resumableState` into its `<head>`.

**Pass 2: Stitch into User's Document.** This initial render is buffered into an in-memory string. The preamble and the rendered app are extracted. Then, the user's `Document` component is rendered, and the extracted preamble and app content are injected into the final HTML string.

The final output is a complete HTML document that respects the user's custom `Document` structure while also containing the state required for successful client-side hydration.

##### Performance Trade-offs

This two-pass approach successfully solves the hydration problem while preserving the framework's API philosophy, but it introduces a performance trade-off, primarily affecting Time To First Byte (TTFB).

Because the process buffers the complete server render of the application before sending any response, the browser does not receive any data until the most computationally expensive part of the process is finished. This negates the primary benefit of HTTP streaming for initial page loads.

This trade-off is considered acceptable for two main reasons:

1.  **API Consistency:** It preserves the simple and powerful user-controlled `Document` API, which is a core design principle.
2.  **Bottleneck Reality:** The server-side render of the application is almost always the slowest part of the process. While TTFB is delayed, the total server response time is not significantly longer than it would be with a pure streaming solution.

This implementation prioritizes developer experience and architectural integrity, with the understanding that a more complex, fully-streaming stitching solution could be implemented in the future if the TTFB impact becomes a critical issue for users.
