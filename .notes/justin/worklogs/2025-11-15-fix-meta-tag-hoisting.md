# Work Log: Fix Meta Tag Hoisting

**Date:** 2025-11-15
**Author:** Justin

## Problem

React's declarative `<title>` and `<meta>` tags, which are expected to be hoisted to the document `<head>`, are not being correctly placed during Server-Side Rendering (SSR). Instead of appearing in the `<head>` of the initial HTML document, they are rendered within the `<body>` where the React application is mounted. This negatively impacts SEO and initial page metadata.

The root cause lies in our hybrid rendering architecture, which uses two separate, parallel render streams: one for the outer document shell (`outerHtmlStream`) and one for the application itself (`appHtmlStream`). The streams are then stitched together. React's hoisting mechanism works correctly, but only within the confines of its own render pass. It hoists the meta tags to the top of the `appHtmlStream`, but by the time this stream is processed, the `<head>` from the `outerHtmlStream` has already been sent to the client.

## Investigation

1.  **Reproducing the Bug:**
    *   Created a new playground example, `playground/meta-hoisting`, to serve as a consistent test case.
    *   The test page included `<title>` and `<meta>` tags nested deeply within the component tree (`Home -> ComponentA -> ComponentB -> Metadata`).

2.  **Stream Logging:**
    *   Added logging to the `stitchDocumentAndAppStreams` utility to inspect the raw chunks coming from the `appHtmlStream`.
    *   The logs consistently showed that React successfully hoists the meta tags to the very beginning of the app stream's output, regardless of their nesting depth.

    *Log Output:*
    ```
    --- app stream chunk --- <title>Hoisted Title</title><meta name="description" content="This is a hoisted description."/><div>...remaining app html...</div>
    ```

3.  **Conclusion:** The investigation confirms that the issue is not with React's hoisting, but with our stream stitching architecture. The hoisted tags are available, but they arrive too late in the process to be placed in the document's `<head>`.

## Brainstorming Solutions

### Idea 1: Pre-emptive Stream Parsing ("Peeking")

This approach involves inspecting the `appHtmlStream` before the main stitching process begins to extract any hoisted tags.

*   **How it would work:**
    1.  Before the primary stitching logic, a preliminary "hoisting" phase would read from the `appHtmlStream`.
    2.  It would buffer the initial chunks and use a regular expression to capture all tags that React hoists (`<title>`, `<meta>`, `<link>`, etc.) from the beginning of the stream.
    3.  This parsing would stop as soon as the first non-hoistable HTML element (e.g., a `<div>`) is encountered.
    4.  The captured tags would then be prepended to the very beginning of the final, stitched output stream, effectively placing them before the `<!DOCTYPE html>` declaration, which browsers handle gracefully by moving them into the `<head>`.
    5.  The remainder of the `appHtmlStream` (after the hoisted tags) would be processed by the existing stitching logic.

*   **Pros:**
    *   Aligns with the existing two-stream architecture.
    *   Contains the complexity within the `stitchDocumentAndAppStreams` utility.
    *   Low risk of causing regressions in hydration or client-side navigation.

*   **Cons:**
    *   Introduces a small amount of buffering, which could slightly delay the start of the stream.
    *   Relies on regex parsing of the HTML stream, which can be brittle if not handled carefully.

### Idea 2: Single, Unified Render Pass

This idea explores abandoning the two-stream approach in favor of a single, nested render.

*   **How it would work:** Render the `innerAppNode` directly inside the `<Document>` component in a single `renderHtmlStream` call.

*   **Why it won't work:** This approach was previously attempted and abandoned for a critical reason related to our architecture's handling of client-side interactions. The RSC payload generated for the application is reused for subsequent client-side navigations and Server Actions. This payload must represent *only* the hydratable application tree, not the entire document shell. The client-side runtime cannot and should not re-render the outer document (`<html>`, `<body>`, etc.) on a navigation. Separating the app and document renders is fundamental to ensuring we have a clean, reusable RSC payload for the client, which is why this idea is not feasible.

## Plan of Action

**Idea 1 (Pre-emptive Stream Parsing)** is the clear path forward. It directly addresses the problem by intercepting the hoisted tags at the only point they are available, while respecting the architectural constraints that make Idea 2 unworkable.

The implementation will involve modifying the `stitchDocumentAndAppStreams` function to include a preliminary parsing step that extracts the meta tags from the beginning of the app stream and prepends them to the final output.
