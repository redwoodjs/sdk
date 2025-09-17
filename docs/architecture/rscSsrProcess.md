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

#### The Two-Stream Stitching Solution

To resolve this, the framework employs a two-stream stitching strategy that satisfies both requirements while maintaining the performance benefits of streaming. Two separate render processes are executed concurrently, and their resulting streams are stitched together on the fly to create the final HTML output.

**Stream 1: The React Shell.** First, React's renderer is called with *only* the application's core content. This produces a stream containing a minimal `<html>` shell where the `<head>` includes the critical preamble with `resumableState`.

**Stream 2: The User Document.** Concurrently, the user's `Document` component is rendered into its own stream.

A final transform stream is used to combine them. It processes the user's `Document` stream, injects the preamble extracted from the React Shell stream into the `<head>`, and pipes the body of the React Shell stream into the body of the user's `Document`.

The final output is a complete HTML document that respects the user's custom `Document` structure while also containing the state required for successful client-side hydration.

##### Performance Considerations

This two-stream stitching approach successfully solves the hydration problem while preserving the framework's API philosophy and the benefits of streaming. However, it does introduce a minor performance trade-off in the form of head-of-line blocking.

**What is Head-of-Line Blocking?**
Head-of-line blocking, in this context, means that the final HTML stream sent to the browser cannot begin until a small, initial part of the internal React Shell stream has been processed. Specifically, the process must wait until it has received and parsed the entire `<head>` from the React Shell to extract the preamble. The rendering of the final `<body>` can only begin after this is complete.

**Why is this Acceptable?**
This trade-off is considered acceptable for two main reasons:

1.  **Minimal Buffering:** The amount of data that needs to be buffered is very small—only the content of the `<head>` tag from React's minimal shell. This results in a negligible delay to the Time To First Byte (TTFB) when compared to buffering the entire page. The main application content within the `<body>` remains fully streamed from end to end.
2.  **Architectural Integrity:** It is a small price to pay to preserve the simple and powerful user-controlled `Document` API, which is a core design principle, without sacrificing the core benefits of streaming. It allows the framework to achieve correctness without compromising on its developer experience goals.
