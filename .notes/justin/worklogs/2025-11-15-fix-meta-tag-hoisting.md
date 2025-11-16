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

## Implementation

Added a new `extract-hoisted` phase to the `stitchDocumentAndAppStreams` function that runs before the main stitching logic:

1. **Hoisted Tag Extraction:** The function reads from the `innerHtml` stream and buffers chunks until it can identify where hoisted tags end. It uses a regex pattern `/<(?!(?:title|meta|link|style|base)[\s>\/])/i` to find the first tag that is not a hoistable tag (title, meta, link, style, or base).

2. **Tag Storage:** When a non-hoistable tag is found, everything before it is extracted as hoisted tags. The remainder of the buffer (containing the non-hoistable content) is stored in `innerBufferRemains` for use in the subsequent `inner-shell` phase.

3. **Prepending:** The extracted hoisted tags are immediately enqueued to the output stream controller, placing them at the very beginning of the final HTML output (before the `<!DOCTYPE html>` declaration).

4. **Stream Continuation:** The existing stitching logic continues unchanged, but now uses `innerBufferRemains` when entering the `inner-shell` phase to ensure no content is lost or duplicated.

The implementation handles edge cases:
- Stream ending during extraction (checks if remaining buffer contains hoisted tags)
- No hoisted tags present (proceeds normally without prepending)
- Hoisted tags split across multiple chunks (buffers until non-hoistable tag is found)

The regex approach is intentionally simple and focused on identifying where hoisted tags end, rather than trying to parse the exact structure of each tag. This reduces brittleness while still correctly extracting the hoisted content that React places at the start of the app stream.

## Refined Implementation: Stream Splitting

The initial implementation, while functional, added complexity to the core `stitchDocumentAndAppStreams` state machine. A cleaner, more surgical approach was developed to better separate concerns.

The refined solution extracts the tag-hoisting logic into a dedicated utility function, `splitStreamOnFirstNonHoistedTag`, which acts as a pre-processor for the application stream.

### Rationale

1.  **Separation of Concerns:** The primary motivation was to isolate the two distinct responsibilities: extracting hoisted tags and stitching the main document streams. The `splitStreamOnFirstNonHoistedTag` function is now solely responsible for parsing the beginning of the application stream, while `stitchDocumentAndAppStreams` focuses purely on interleaving the document and app body.

2.  **Surgical Change:** This approach avoids complex modifications to the existing, well-tested stitching state machine. Instead of adding a new phase and conditional buffer logic to the main function, we simply pre-process the input stream. This minimizes the risk of introducing regressions into the complex stream-stitching logic.

3.  **Clarity and Maintainability:** The code is now easier to understand and maintain. The stream transformation is explicit and self-contained. Any future logic related to hoisted tags can be managed within the `split...` function without affecting the core stream stitching.

### How It Works

1.  **`splitStreamOnFirstNonHoistedTag(innerHtml)`:**
    *   This new helper function is called at the beginning of `stitchDocumentAndAppStreams`.
    *   It takes the original `innerHtml` stream as input.
    *   It returns a tuple of two new `ReadableStream` instances: `[hoistedTagsStream, appBodyStream]`.

2.  **Stream Processing Logic:**
    *   The function reads from the source `innerHtml` stream and buffers the initial chunks.
    *   It uses a regular expression (`/<(?!(?:\/)?(?:title|meta|link|style|base)[\s>\/])(?![!?])/i`) to find the first occurrence of an HTML tag that is **not** a hoistable tag (e.g., `<div>`). This regex correctly handles both opening and closing hoistable tags (like `</title>`).
    *   All content *before* this marker is piped to the `hoistedTagsStream`. Once the marker is found, this stream is closed.
    *   The marker itself and all subsequent content from the original stream are piped to the `appBodyStream`.

3.  **Updated Stitching Process:**
    *   The `stitchDocumentAndAppStreams` function introduces a new initial phase, `"enqueue-hoisted"`.
    *   In this phase, it reads everything from the `hoistedTagsStream` and immediately enqueues it to the final output. This places the hoisted tags at the very beginning of the response.
    *   Once the `hoistedTagsStream` is fully consumed, the function transitions to the `"outer-head"` phase.
    *   The rest of the state machine proceeds exactly as it did before, but it now uses the `appBodyStream` as its source for the application content.

---

## PR

### fix(ssr): Ensure hoisted meta tags are correctly placed in document head

During server-side rendering, React's hoisted tags (e.g., `<title>`, `<meta>`) were incorrectly rendered in the `<body>` instead of the document `<head>`. This occurred because the framework's two-stream rendering architecture sent the document shell, including the `<head>`, before the application stream containing the hoisted tags was processed.

This change introduces a stream-splitting utility, `splitStreamOnFirstNonHoistedTag`, that pre-processes the application's HTML stream. The function separates the stream into two distinct streams: one containing the hoisted tags from the beginning of the stream, and a second containing the remainder of the application body.

The main stream-stitching logic is updated to first exhaust and prepend the hoisted tags stream to the response, ensuring they appear before the `<!DOCTYPE html>` declaration. It then proceeds with the existing logic for interleaving the document and application body streams. This approach isolates the new logic and preserves the integrity of the two-stream architecture, which is necessary for client-side navigation and hydration.
