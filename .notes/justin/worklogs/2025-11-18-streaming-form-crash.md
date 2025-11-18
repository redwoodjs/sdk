# 2025-11-18 Streaming Form Crash

## Context
There is a bug reported where an app with `renderToStream` and a form action crashes.
Issue: https://github.com/redwoodjs/sdk/issues/881
Reproduction: https://github.com/valscion/rwsdk-reproductions/tree/main/rwsdk-minimal-streaming-form-repro

The crash happens when submitting a form action on a page rendered via `renderToStream`.
Error: `Uncaught error: Error: Connection closed.` in `react-server-dom-webpack-client`.

## Plan
1. Create a playground reproduction `playground/streaming-form-crash` based on `playground/hello-world`.
2. Copy source files from the reproduction repository.
3. Verify the crash manually.
4. Investigate the cause.
5. Fix the issue.
6. Add regression tests.

## Work Log

### Reproduction Setup
I created `playground/streaming-form-crash` based on `hello-world` and copied source from the reproduction repo.
The user reported the crash happens on `/stream` when clicking the button. The standard route `/` works fine.

The `/stream` route implementation:
```tsx
route("/stream", async () => {
  return new Response(await renderToStream(<Home />, { Document }), {
    status: 200,
    headers: {
      "content-type": "text/html",
      "cache-control": "no-transform",
    },
  });
}),
```
versus the working `/` route:
```tsx
render(Document, [
  route("/", Home),
]),
```

The error "Connection closed" typically implies the server action response isn't making it back or is malformed in a way the client RSC runtime doesn't like when it expects a stream update.

### Reproduction Verification
I verified the crash on the `/stream` link. The default route works as expected.

### Investigation
I compared the implementation of the standard `render` route handler (`renderPage` in `worker.tsx`) vs `renderToStream`.

`renderPage` logic:
1. Checks for `isRSCRequest` (triggered by client-side navigation or actions).
2. If `isRSCRequest`, it returns a response with `Content-Type: text/x-component` and the raw RSC stream.
3. If not, it returns `text/html` and the HTML stream (with RSC payload injected).
4. It retrieves `requestInfo.rw.actionResult` (result of the server action) and passes it to `renderToRscStream`.

`renderToStream` logic (`sdk/src/runtime/render/renderToStream.tsx`):
1. It accepts `element` and `options`.
2. It **hardcodes** `actionResult: undefined` when calling `renderToRscStream`.
3. It **always** generates an HTML stream (calling `renderDocumentHtmlStream`). It does not seem to have a mode to return just the RSC stream.

**Root Cause Theory**:
When the form action is submitted, the client sends a POST request expecting an RSC response (to update the UI).
The custom `/stream` route uses `renderToStream`.
1. `renderToStream` generates HTML instead of the expected RSC data.
2. `renderToStream` ignores the action result, so the UI wouldn't update correctly even if the format was right.
3. The user's route handler forces `Content-Type: text/html`.
The client receives HTML when it expects RSC, or the connection closes unexpectedly because of a mismatch in processing, leading to the crash.

### Failed Fix Attempts & Learnings

**Attempt 1: Patch `renderToStream` logic**
I initially planned to patch `renderToStream` to check for `isRSC` requests (via headers/URL) and return the raw RSC stream if detected.
*Problem*: `renderToStream` returns `Promise<ReadableStream>`. The user's code (which calls `renderToStream`) manually wraps this stream in a `Response` and sets the `Content-Type` to `text/html`. If `renderToStream` returned an RSC stream, the user code would serve it as HTML, causing client-side errors anyway. The API contract of `renderToStream` implies "give me an HTML stream".

**Attempt 2: Refactor `worker.tsx` and `renderToStream` to share a "universal" renderer**
I considered extracting a helper (`createRenderStream`) that both `renderToStream` and the main router logic (`worker.tsx`) could use. This helper would handle the complexity of "if RSC request, return RSC stream; else return HTML stream".
*Problem*: This would require a significant refactor of the core `worker.tsx` logic, which is risky and "too big a change" for a bug fix. It also felt like the helper was "doing too much" by handling business logic branching inside a low-level rendering utility.

**Attempt 3: "Surgical" Helpers**
I tried breaking down the logic into smaller, reusable helpers (`isRSCRequest`, `createHtmlStream`) to reuse in both places without a major refactor.
*Problem*: While cleaner, it didn't solve the fundamental API UX issue. `renderToStream` would effectively return *either* an HTML stream or an RSC stream depending on the request context, but the caller (user code) wouldn't know which one it got. This makes it impossible for the user to set the correct `Content-Type` header without duplicating the `isRSC` check themselves. This is a bad developer experience (UX) and a footgun.

### Conclusion
We realized that `renderToStream` is fundamentally designed for *generating an HTML stream*. It is not designed to handle the full lifecycle of a Redwood app route (which requires negotiating between HTML and RSC responses).

Trying to force `renderToStream` to handle RSC requests breaks its contract and confuses the user consumption model (stream vs response headers).

Instead of patching `renderToStream`, we need a new API (e.g., `renderToResponse`) that encapsulates the entire response generation logic (negotiating Content-Type and body format), or we need to explicitly document that `renderToStream` does *not* support interactivity/actions on its own and is strictly for HTML generation.

### RFC Draft: `renderToResponse` Helper

**Problem**
`renderToStream` is fundamentally designed for *generating an HTML stream*. It is not designed to handle the full lifecycle of a RedwoodSDK app route (which requires negotiating between HTML and RSC responses).

Trying to force `renderToStream` to handle RSC requests breaks its contract and confuses the user consumption model (stream vs response headers).

Instead of patching `renderToStream`, we need a new API (e.g., `renderToResponse`) that encapsulates the entire response generation logic (negotiating Content-Type and body format), or we need to explicitly document that `renderToStream` does *not* support interactivity/actions on its own and is strictly for HTML generation.

**Proposed Solution**
Introduce a new high-level helper: `renderToResponse`.

```typescript
export function renderToResponse(
  element: ReactElement,
  options: RenderOptions
): Promise<Response>
```

This helper will:
1.  Accept the component tree and standard options (Document, requestInfo, etc.).
2.  Inspect `requestInfo` to determine if the request is an **RSC request** (Action or Client Transition).
3.  **If RSC Request**:
    *   Generate the raw RSC stream (including Action results).
    *   Return a `Response` with `Content-Type: text/x-component`.
4.  **If HTML Request**:
    *   Generate the HTML stream (with injected RSC payload).
    *   Return a `Response` with `Content-Type: text/html`.

**Benefits**
*   **Safe Default**: Users get the correct behavior for both initial loads and interactivity without manual configuration.
*   **DRY**: This logic is currently embedded in internal logic for `defineApp`. Extracting it to a public helper allows "manual" routes to have feature parity with standard `render()` routes.
*   **Clear API Boundary**: `renderToStream` remains a low-level primitive for "give me HTML", while `renderToResponse` becomes the standard for "render this page" when users need to do so programmatically/imperatively instead of the default declarative `route()` API.

**Example Usage**

```typescript
// worker.tsx
route("/my-custom-route", async (requestInfo) => {
  // Before: Crashes on interaction
  // return new Response(await renderToStream(<MyPage />, { Document }), { ... });

  // After: Works with Actions/Transitions
  return renderToResponse(<MyPage />, { Document, requestInfo });
});
```
