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

## 4. Final Architecture: Suspense-Aware Stitching with Refined Logic

The "Unified RSC Render" approach was re-evaluated and determined to be overly complex. The marker-based interleaving strategy was ultimately successful after two critical fixes were implemented.

### The Core Problem: A Cascade of Mismatches

The investigation revealed a cascade of issues that masked the root cause:

1.  **DOM Structure Mismatch:** The initial attempts to inject a marker component (first a `div`, then a custom element) failed because they were wrapped in a `<React.Fragment>` on the server. This created a component tree that was structurally different from the client's RSC payload, which does not contain the fragment. This was the primary cause of the hydration failures.
2.  **Stream Stitching Bug:** A logic flaw in the `stitchDocumentAndAppStreams` utility was causing content from the document and app streams to be mixed in a shared buffer. This corrupted the HTML, placing the closing `</div>` tag for the `#hydrate-root` element *before* the application content, further breaking the DOM structure.
3.  **Underlying `useId` Mismatch:** Once the stitching bug and the structural mismatch were fixed, a final, underlying issue was revealed: the server and client were using different `useId` counters, leading to the classic `_R_1_` vs `_r_0_` mismatch.

### The Fix: A Three-Part Solution

The final, working solution addresses all three issues:

1.  **Corrected Stitching Logic:** The bug in `stitchDocumentAndAppStreams` was fixed by introducing a separate buffer for the document stream's remainder. This ensures the two streams are processed cleanly and never mixed.
2.  **No App Wrapper:** The `<React.Fragment>` wrapper and the custom marker component were removed. The RSC `innerAppNode` is now passed directly to the renderer, guaranteeing that the server-side component tree is identical to the client-side RSC payload.
3.  **Reliable End Marker:** Instead of injecting a custom marker, the solution now uses React's native streaming behavior. When React hits a `<Suspense>` boundary, it emits a `<template>` tag for the suspended content. The stitcher now uses the first occurrence of `"<template"` as the unambiguous signal for the end of the initial, non-suspended HTML shell.

This combination of fixes ensures the DOM structure is correct, the `useId`s are synchronized, and the client script is delivered for early hydration without being blocked by Suspense.

### Subsequent Findings & Final Solution

Further testing revealed that relying on React's internal streaming markers (like `<template>` or `<!--$-->`) was brittle. The specific markers React uses are an implementation detail and not guaranteed to be stable. This approach was abandoned in favor of a more explicit and robust strategy.

The final, successful solution was to inject markers directly into the RSC payload.

1.  **Markers in the RSC Payload:** In `worker.tsx`, the `pageElement` is now wrapped in a fragment that includes a `<div id="rwsdk-app-end" />` as a sibling. This guarantees the marker is part of the component tree for both the server render and the client hydration, ensuring perfect structural integrity.
2.  **Consistent Marker Structure:** For consistency, the start marker in `renderDocumentHtmlStream.tsx` was also changed to a `<div id="rwsdk-app-start" />`.
3.  **Updated Stitching Logic:** The `stitchDocumentAndAppStreams` utility was updated to look for these new, explicit `div` markers. It was also corrected to leave the `rwsdk-app-end` marker in the final DOM, ensuring the client and server see the exact same markup.

This combination is the most robust solution, as it doesn't rely on React's internal implementation details and guarantees a consistent DOM between the server and client.

## 6. Regression in v1.0.0-alpha.17 and Subsequent Fix

Following the release of `v1.0.0-alpha.17`, users reported a regression where the application would remain blank until all `<Suspense>` boundaries were resolved. This was a step backward from `v1.0.0-alpha.16`, where the UI was visible but not interactive.

### Analysis

The regression was traced to the direct usage of the `renderToStream` API. The previous fix, which involved injecting a `<div id="rwsdk-app-end" />` marker into the RSC payload, was implemented within the `defineApp` helper in `worker.tsx`. This meant that projects using the lower-level `renderToStream` API directly did not benefit from the fix, as their rendering path did not include this marker. Without the marker, the stream-stitching logic could not correctly interleave the document and application streams, leading to the observed blocking behavior.

### Solution: Centralizing the Marker Injection

To resolve this, the marker injection logic was moved from `worker.tsx` into `renderToRscStream.tsx`. By placing the logic at this lower level, any part of the system that generates an RSC stream-whether through the high-level `defineApp` or direct calls to `renderToStream`-will now automatically include the necessary marker. This ensures consistent behavior across all rendering paths.

To prevent future regressions, a new end-to-end test was added to the `non-blocking-suspense` playground specifically to validate early hydration when using `renderToStream` with a suspended component.

## 5. PR Title and Description

**Title:** `fix(streaming): Ensure Early Hydration with Suspense-Aware Stream Interleaving`

**Description:**

### Context: The Previous Rendering Architecture

Previously, the framework rendered the `<Document>` shell and the application content in two separate server passes. It then stitched the two resulting HTML streams together. This was done to solve a `useId` hydration mismatch by preventing the document's render from interfering with the app's render.

### Problem: Blocked Hydration with Suspense

While this approach fixed the `useId` issue, it caused a problem with Suspense. The stream stitching would wait for the entire application stream to complete before sending the rest of the document.

If the application used `<Suspense>`, React would pause the app stream to wait for data. This pause meant the rest of the document stream, including the `<script>` tag for client-side hydration, was also delayed. The UI shell would appear in the browser, but it would not be interactive until all data fetching was finished.

### Solution: Interleaving Streams via RSC Payload Markers

This change updates the stream stitching to be aware of Suspense boundaries.

The solution works by injecting a marker component (`<div id="rwsdk-app-end" />`) directly into the RSC payload on the server. Because this marker is part of the payload, it is present in both the server-side HTML render and the client-side component tree, which guarantees structural consistency and prevents hydration errors.

A utility then uses this marker in the HTML stream to intelligently interleave the document and application streams. It sends the document head, then the initial app content (up to the marker), then the *rest of the document body* (including the client script), and only then streams the suspended content from the app before finally closing the document.

This ensures the client script is sent to the browser as soon as the initial UI is ready, making the page interactive right away, without re-introducing `useId` bugs or relying on brittle implementation details of React's streaming format.

For a detailed explanation, see the updated [Hybrid Rendering documentation](/docs/architecture/hybridRscSsrRendering.md).

## 7. PR Title and Description

**Title:** `fix(streaming): Extend early hydration fix to renderToStream API`

**Description:**

### Context: The Previous Fix in `v1.0.0-alpha.17`

In a recent change ([#786](https://github.com/redwoodjs/sdk/pull/786)), we fixed a regression where client-side components would not become interactive until all server-side `<Suspense>` boundaries had resolved. The solution involved injecting a marker component into the RSC payload, allowing our stream-stitching logic to send the client hydration script before the full application stream had completed.

### Problem: Regression for `renderToStream` Users

That fix was implemented within our high-level `defineApp` helper. This meant that users who bypassed this helper and used the lower-level `renderToStream` API directly did not receive the marker in their RSC payload.

As a result, they experienced a worse regression: the entire UI would remain blank until the suspended data was ready, as the stream-stitching logic had no marker to guide its interleaving process and would wait for the entire app stream to finish.

### Solution: Centralizing the Marker Injection

This change moves the marker-injection logic from the `defineApp` helper in `worker.tsx` down into the `renderToRscStream.tsx` utility.

Because `renderToRscStream` is used by both the high-level helper and direct API calls, this change ensures that the marker is present in the RSC payload regardless of which rendering path is taken. This restores correct, non-blocking hydration behavior for all users.

A new end-to-end test has also been added to specifically cover the `renderToStream` use case with `<Suspense>`, ensuring this behavior is protected against future regressions.

