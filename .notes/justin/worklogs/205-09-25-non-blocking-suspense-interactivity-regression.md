## 4. Final Architecture: A Marker-Based, Non-Blocking Stream Interleaving Strategy

The "Unified RSC Render" approach was re-evaluated and determined to be overly complex. The marker-based interleaving strategy was ultimately successful after a series of critical fixes addressed a cascade of underlying issues.

### The Core Problem: A Cascade of Mismatches

The investigation revealed several layers of issues that masked the root cause:

1.  **Initial DOM Structure Mismatch:** The first attempts to inject a marker component failed because they were wrapped in a `<React.Fragment>` on the server. This created a component tree that was structurally different from the client's RSC payload, causing hydration to fail.
2.  **Stream Stitching Bug:** A logic flaw in the `stitchDocumentAndAppStreams` utility was causing content from the document and app streams to be mixed in a shared buffer. This corrupted the HTML, placing the closing `</div>` tag for the `#hydrate-root` element *before* the application content, further breaking the DOM structure.
3.  **Marker Injection Flaw:** Relying on React's internal streaming markers (like `<template>` or `<!--$-->`) proved to be brittle, as these are implementation details that can change.

### The Fix: An Explicit, Consistent, and Robust Solution

The final, working solution is explicit, consistent, and addresses all issues:

1.  **Markers in the RSC Payload:** To guarantee structural integrity, markers are now injected directly into the RSC payload itself. In `worker.tsx`, the `pageElement` is wrapped in a fragment that includes a `<div id="rwsdk-app-end" />` as a sibling. This ensures the marker is present in the component tree for both the server render and the client hydration.
2.  **Consistent Marker Structure:** For consistency, the start marker in `renderDocumentHtmlStream.tsx` was also changed to a `<div id="rwsdk-app-start" />`.
3.  **Corrected Stitching Logic:** The bug in `stitchDocumentAndAppStreams` was fixed by introducing a separate buffer for the document stream's remainder, ensuring the two streams are processed cleanly. The logic was also updated to use the new `div` markers as signals, leaving the end marker in the final DOM to ensure consistency, while removing the start marker.

This combination of fixes ensures the DOM structure is correct, the `useId`s are synchronized, and the client script is delivered for early hydration without being blocked by Suspense.

## 5. PR Title and Description

**Title:** `fix(streaming): Ensure Early Hydration with Suspense-Aware Stream Interleaving`

**Description:**

```

