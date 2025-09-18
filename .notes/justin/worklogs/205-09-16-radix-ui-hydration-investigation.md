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
