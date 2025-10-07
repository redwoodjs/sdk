# 2025-10-07: Investigating Worker Hang and Refactoring Render Control Flow

## Problem

While working on the demo, I encountered a persistent issue where requests to pages involving database queries (e.g., the Todos page) would hang indefinitely, eventually being terminated by the Cloudflare Workers runtime with a "worker's code had hung" error. This error masked the true underlying problem.

## Investigation

My initial investigation led down several incorrect paths:

1.  **Application-Level Timeout:** I first suspected the Prisma query itself was simply slow. I added a `Promise.race` timeout within the `getTodos` function. This was ineffective; the worker still hung, suggesting the hang was happening at a lower level that blocked the JavaScript event loop, preventing the `setTimeout` from ever firing.

2.  **Error Handling Flag:** I then theorized that an error was being thrown but mishandled, causing us to hang on a final `await rw.pageRouteResolved?.promise;` in the `worker.tsx` runtime. I introduced a `didError` flag in the top-level `catch` block to prevent this `await`. This was logically flawed, as the `catch` block would always terminate the request, meaning the code after it would never be reached on an error path anyway.

The key insight came from re-examining the purpose of the `await rw.pageRouteResolved?.promise;`. Its role is to keep the worker alive while React's async render stream completes. It also serves as a control flow mechanism for short-circuiting renders (e.g., for redirects), as detailed in the architecture docs. A component can `throw new Response()`, which is caught, rejects this promise, and allows the main `fetch` handler to proceed with the thrown response.

The current architecture's weakness is that it does not account for a silent hang. When the render stream freezes (due to the Prisma issue), it never signals completion or failure. The `pageRouteResolved` promise remains pending forever, and the `await` hangs the worker.

## New Plan: Refactor to AbortSignal

The deferred promise is the wrong tool for this job. It creates a "dangling promise" scenario that is fundamentally incompatible with the worker environment.

The correct, platform-native solution is to use an `AbortSignal`. The `renderToReadableStream` function accepts a `signal` in its options, allowing for robust, standardized cancellation.

The new plan is as follows:

1.  **Create a Regression Test:** Build a new playground example (`short-circuit-render`) that specifically tests the "throw a `Response` to short-circuit" behavior. This will ensure we don't break existing, critical functionality when we refactor.
2.  **Refactor the SDK:** Replace the `pageRouteResolved` deferred promise mechanism in `sdk/src/runtime` with a standard `AbortController`. When a short-circuit is needed, we will call `controller.abort()` instead of rejecting a promise. This will cleanly terminate the render stream without the risk of a dangling promise.
