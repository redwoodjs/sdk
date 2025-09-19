## 23. Course Correction: Reverting Flawed Architecture

Upon review, it became clear that the entire stream-coalescing architecture (documented in sections 16-22) was a complex solution to a problem that was misunderstood. The evidence from the React source code shows that the `resumableState` is not a byproduct of rendering a full HTML shell, but a direct result of providing the correct bootstrap options to `renderToReadableStream`.

The previous approach was a rabbit hole. The complex logic of `assembleHtmlStreams` and the `streamExtractors` is unnecessary. The correct approach is a much simpler, more traditional SSR setup where React renders the application stream, and that stream is passed as children to the user's `Document`.

To correct this, all source code and architecture documentation changes related to the stream-coalescing implementation are being reverted to the state on the `main` branch. This provides a clean foundation to apply the correct, simpler fix. The history of this incorrect path is preserved in this log as a record of the investigation.

## 24. Research: The `bootstrapModules` vs. `bootstrapScriptContent` APIs

Before attempting a new implementation, a thorough investigation is required to understand why a new attempt with `bootstrapModules` should succeed where the previous attempt with `bootstrapScriptContent` failed. The goal is to find definitive proof in the React source code.

### Research Questions
1.  What is the precise, internal difference in how React's server renderer handles `bootstrapModules`, `bootstrapScripts`, and `bootstrapScriptContent`?
2.  What is the exact mechanism by which these options trigger the serialization of `resumableState`?
3.  How will React's behavior when using `bootstrapModules` interact with our framework's existing script discovery and transformation architecture, as detailed in `unifiedScriptDiscovery.md` and `documentTransforms.md`?

No source code will be modified until this research is complete and the findings are documented here.

## 65. Refined Hypothesis: The JavaScript State Race Condition

My investigation has reached a more precise understanding of the problem, thanks to a critical observation about script placement and the nature of React hydration.

The previous line of thinking focused on whether the DOM was "ready" for the client script. However, as correctly pointed out, our architecture (`Document.tsx`) ensures the client entry script runs *after* the server-rendered HTML for the application shell is already in the DOM. The server-generated IDs (e.g., `_R_76_`) are present and readable at the moment our script executes.

This invalidates any theory that React "can't find" the DOM nodes. The nodes are there.

### The Real Issue: Regenerating vs. Reading

The key insight is that React's hydration process for `useId` does not involve *reading* the ID from the existing DOM. Instead, it attempts to *regenerate* an identical component tree in memory on the client. For hydration to succeed, the `useId` hook, when called during this client-side regeneration, must produce the exact same string (`_R_76_`) that the server produced.

This regeneration depends entirely on an internal JavaScript state object, the `TreeContext`, which acts as the seed for the ID counter.

### The True Race Condition

The problem is a race condition between two JavaScript processes on the client:

1.  **Our `initClient` script:** This script executes immediately and calls `hydrateRoot`.
2.  **React's internal seeding script:** Some other script, delivered by the server, is responsible for carrying the `TreeContext` state and applying it to the client-side React runtime.

Our `initClient` is winning this race. It's kicking off the hydration process before the seeding script has had a chance to run. As a result, `useId` runs with its default, unseeded `TreeContext` (starting at 0), generates `_r_0_`, and causes the mismatch.

This perfectly explains why the `DOMContentLoaded` workaround is effective: it is a blunt but reliable way to ensure that *all* scripts on the page, including the yet-unidentified seeding script, have been parsed and executed before hydration begins.

### Next Step: Prove the Unseeded State

The immediate goal is to prove this theory with logs. We need to confirm that the `TreeContext` is in its default state at the moment of hydration.
