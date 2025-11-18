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

