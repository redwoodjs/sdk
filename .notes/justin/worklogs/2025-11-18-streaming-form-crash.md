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
I verified the crash on the `/stream` link. The default route works as expected. Now investigating the root cause.
