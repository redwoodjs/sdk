# Work Log: 2025-09-25 - Non-blocking Suspense Interactivity Regression

## 1. Problem Definition

A regression has been identified where client-side components are not interactive until server-side `<Suspense>` boundaries have fully resolved. This breaks the intended "early hydration" architecture, which is designed to make the initial UI shell interactive while data is still streaming.

### Initial Findings

-   **Symptom:** In the `non-blocking-suspense` playground, a client-side counter button is unresponsive while a sibling component is suspended.
-   **DOM Analysis:** The browser's HTML output confirms the issue. The client entry point script (`<script>import("/src/client.tsx")</script>`) is absent from the initial document stream. It only appears after the Suspense fallback is replaced with the final content, indicating that the script tag's delivery is blocked by the stream's completion.

**HTML Before Suspense Resolves:**
The document is incomplete; the closing `</div>`, `</body>`, `</html>` and the crucial client `<script>` tag are missing. The stream is paused while waiting for the remote request.

**HTML After Suspense Resolves:**
The document is complete, and the `<script nonce="">import("/src/client.tsx")</script>` tag is now present at the end of the body. Hydration and interactivity only begin at this point.

### Architectural Context & Hypothesis

This behavior strongly suggests a regression related to the "stream stitching" architecture, which was introduced to solve a `useId` hydration mismatch (see work log `2025-09-16-radix-ui-hydration-investigation.md`). This architecture uses two separate, isolated renders on the server (one for the document shell, one for the application content) and stitches their resulting HTML streams together.

The primary hypothesis is that the `injectHtmlAtMarker` utility, which performs this stitching, is implemented in a way that it fully consumes the application stream (including waiting for Suspense boundaries to resolve) before it continues processing the rest of the document shell stream, which contains the client script tag. This would effectively serialize the process, blocking the shell on the content, and causing the observed regression. The next step is to analyze this utility to confirm this behavior.

## 2. Analysis and Solution

Analysis of `sdk/src/runtime/lib/injectHtmlAtMarker.ts` confirmed the hypothesis. The implementation contained a critical flaw:

```typescript
// When the marker was found in the outer stream...
flushText(buffer.slice(0, markerIndex));

// It would then BLOCK and wait for the entire inner stream to finish.
await pumpInnerStream(); 

// Only AFTER the inner stream was complete would it proceed.
buffer = buffer.slice(markerIndex + marker.length);
injected = true;
```

The `await pumpInnerStream()` call fully consumed the application's HTML stream. If that stream contained a `<Suspense>` boundary, React would pause the stream, and this `await` would not resolve until the suspended data was ready. This blocked the function from processing the remainder of the outer document stream, which contained the client-side `<script>` tag responsible for hydration.

### The Fix

The `injectHtmlAtMarker` utility was refactored to be truly non-blocking. The corrected implementation orchestrates the streams concurrently. When the marker is found, it injects the inner application stream and immediately continues processing the outer document stream in parallel. This ensures that all parts of the document shell, including the critical client script, are sent to the browser as soon as they are ready, without being blocked by the suspended application content. This restores the intended early hydration behavior.

## 3. Re-evaluation: A Deeper Architectural Flaw

The non-blocking fix to `injectHtmlAtMarker` proved to be insufficient. The underlying problem is more fundamental: the very act of stitching two separate streams together creates a situation where the document shell's stream must necessarily wait for the application stream to be injected. Even with non-blocking logic, the placeholder for the app exists at a single point; the browser cannot receive the content that comes after it (like the client script) until the content that comes before it (the app) has been delivered. When the app stream pauses for Suspense, it inevitably blocks the remainder of the document.

### A New Architectural Proposal: Unified RSC Render

This realization leads to a significant architectural pivot. Instead of stitching two different kinds of streams (SSR Document + SSR App), the proposed solution is to create a single, unified render that can be used for both purposes.

The new approach for initial page loads is as follows:

1.  **Unified RSC Render:** The entire page, including the `<Document>` shell and the application content, will be rendered into a single RSC stream. This puts the entire component tree under the control of the React RSC renderer, which can correctly manage Suspense boundaries and ensure the non-suspended parts of the document (including the shell and any scripts within it) can stream to the browser without being blocked.

2.  **Tee the Stream:** This unified RSC stream will be `tee`'d into two identical branches.

3.  **Branch 1 (for Server-Side HTML):** The first branch will be passed to the SSR function (`renderToReadableStream`). This function will consume the RSC payload and render the final, complete HTML document to be streamed to the browser.

4.  **Branch 2 (for Client-Side Payload):** The second branch is needed for client-side hydration and subsequent navigations. However, it contains the entire document, whereas the client expects a payload containing only the application's inner content. To solve this, this branch will be piped through a **new transformation stream**. This transformer's job will be to parse the RSC payload on the fly and "strip out" the outer document shell layers, allowing only the inner application node's payload to pass through. This stripped stream is then injected into the HTML for the client to consume.

This "Unified RSC Render -> Tee -> Strip" strategy is architecturally cleaner and gives React full control over the streaming process. The primary technical challenge to investigate is the feasibility of creating a streaming transformer that can reliably parse and modify the RSC wire format without full buffering.

## 4. A New Streaming Strategy: Marker-Based Interleaving (Surgical Implementation)

The "Unified RSC Render" approach was re-evaluated and determined to be overly complex. A more surgical and robust stream-stitching strategy has been devised that is aware of how React handles Suspense. This approach contains all necessary changes within the SSR rendering logic, requiring no modifications to `worker.tsx`.

### The Core Insight & Flaw in Previous Stitching

The fundamental challenge is that the browser needs the client-side `<script>` tag (from the document shell) to begin hydration, but that tag is located *after* the application content. If the application content stream pauses due to Suspense, the script tag is blocked.

### The New Architecture: Suspense-Aware Stitching

The new approach leverages the fact that React will stream all available, non-suspended HTML content synchronously before the first pause. We can use this behavior by strategically placing a second marker.

The implementation will be as follows:

1.  **Inject an End Marker (in `renderDocumentHtmlStream.tsx`):** For initial page loads, after extracting the `innerAppNode` from the RSC payload stream, it will be wrapped in a `<React.Fragment>`. This fragment will contain two children:
    1.  The original `innerAppNode`.
    2.  A new, special "end marker" component that renders a unique HTML comment (e.g., `<!-- RWSDK_APP_HTML_END -->`).

    Because this marker is a sibling to the application content and is not suspended, React will render it as part of the initial, non-suspended HTML shell when `appNode` is rendered to its own stream.

2.  **Implement a `stitchDocumentAndAppStreams` Utility:** A new, more specialized utility will replace the generic `injectHtmlAtMarker`. It will orchestrate the two streams with the following logic:
    1.  **Stream Document Head:** Read from the document stream and send chunks to the browser until the *start marker* (`<!-- RWSDK_INJECT_APP_HTML -->`) is found.
    2.  **Stream Initial App Shell:** Switch to the app stream. Read from it and send chunks to the browser until the *end marker* (`<!-- RWSDK_APP_HTML_END -->`) is found. This represents the complete, non-suspended part of the application.
    3.  **Stream Document Tail (with script):** Once the app's end marker is found, switch *back* to the document stream. Continue sending its chunks. This is the critical step that sends the remainder of the `<body>`, including the `<script>import("/src/client.tsx")</script>` tag, to the browser, allowing hydration to begin immediately.
    4.  **Pause Before Body End:** Continue streaming the document until the closing `</body>` tag is encountered. Pause here.
    5.  **Stream Suspended App Content:** Switch back to the app stream and pipe the entire remainder of its content. This is all the content that was suspended and is now resolving.
    6.  **Finish Document:** Once the app stream is complete, send the final `</body>` and `</html>` tags from the document stream.

This marker-based interleaving strategy solves the race condition. It ensures the client script is delivered as soon as the initial UI is rendered, without waiting for slow data fetches, restoring the intended non-blocking, early-hydration behavior.

## 5. PR Title and Description

**Title:** `fix(streaming): Ensure Early Hydration with Suspense-Aware Stream Interleaving`

**Description:**

### Context: The Previous Rendering Architecture

Previously, the framework used two separate, isolated rendering passes on the server to produce the initial HTML document: one for the user's `<Document>` shell and one for the application content. The resulting HTML streams were then stitched together. This architecture was implemented to solve a critical `useId` hydration mismatch by ensuring the application's render context was not polluted by the document's render.

### Problem: Blocked Hydration with Suspense

While the isolated render fixed the `useId` issue, it introduced a significant performance regression. The stream stitching logic was naive; it would wait for the *entire* application stream to complete before continuing with the rest of the document stream.

If the application contained a `<Suspense>` boundary, React would pause the stream to wait for data. This pause blocked the document stream from sending the remainder of the `<body>`, which critically contains the `<script>` tag that initiates client-side hydration. As a result, the UI shell would render, but it would remain non-interactive until the slowest data fetch on the page was complete, negating the primary benefit of streaming with Suspense.

### Solution: Suspense-Aware Stream Interleaving

This change replaces the simple stitching mechanism with a more sophisticated, suspense-aware interleaving strategy.

The solution works by strategically injecting a second marker into the application's render stream, signaling the end of the initial, non-suspended content. A new stream orchestration utility uses these markers to intelligently interleave the two streams. It sends the document head, then the initial app shell, then the *rest of the document body* (including the client script), and only then streams the suspended content from the app before finally closing the document.

This ensures the client script is always delivered to the browser as soon as the initial UI is visible, restoring immediate interactivity without re-introducing the original `useId` hydration bug.

For a detailed, step-by-step explanation of this new architecture, please see the updated [Hybrid Rendering documentation](/docs/architecture/hybridRscSsrRendering.md).

