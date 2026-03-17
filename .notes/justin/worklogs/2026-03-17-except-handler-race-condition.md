# Except Handler Race Condition (#1065)

## Task Narrative

We are investigating and fixing GitHub issue #1065: "Server-side error handling not working as documented." The `except` handler runs (the user sees console.error output), but the error page is not returned to the browser. Instead, a Vite HMR error overlay is shown.

## Synthesized Context

- **`except` function** (`sdk/src/runtime/lib/router.ts:760-767`): Creates an `ExceptHandler` that is placed in the compiled routes array. When an error occurs, the router searches backwards for the most recent except handler.
- **`executeExceptHandlers`** (`router.ts:426-453`): Searches backwards through compiled routes, calls the handler, and returns the result via `handleMiddlewareResult`. If the handler returns JSX, it's rendered via `renderPage`.
- **`defineApp` / `worker.tsx`**: Wraps `router.handle` in a `new Promise` where `onError: reject` (line 263). This `onError` callback is passed through to `renderPage`, then to `renderToRscStream` and `renderHtmlStream`.
- **Error propagation in RSC**: When a server component throws, React's `renderToReadableStream` (RSC) calls `onError` and encodes the error in the stream. The error later propagates through `createFromReadableStream` → `renderDocumentHtmlStream` → `renderPage` throw → router catch → except handler.
- **Existing e2e test** (`playground/kitchen-sink`): Tests `/debug/throw` which is a **function** handler (not a component). This path doesn't go through `renderPage`, so the bug is not exercised.

## Known Unknowns

- Whether the fix requires changes only to `worker.tsx` or also to the router
- Whether removing the `new Promise` wrapper has downstream effects

## Investigation: The Race Condition

### Root cause identified

In `worker.tsx:252-270`:

```js
const response = await runWithRequestInfo(
  outerRequestInfo,
  async () =>
    new Promise<Response>(async (resolve, reject) => {
      try {
        resolve(
          await router.handle({
            ...
            onError: reject,  // <-- THE BUG
            ...
          }),
        );
      } catch (e) {
        reject(e);
      }
    }),
);
```

When a **component** throws during RSC rendering:

1. `renderToRscStream` calls `onError(error)` → `reject(error)` → **promise rejects**
2. Error propagates through RSC stream → `createThenableFromReadableStream` → `renderDocumentHtmlStream` throws → `renderPage` throws
3. Router catches it → `executeExceptHandlers` runs → except handler returns JSX → error page rendered
4. `router.handle` resolves with error page Response → `resolve(response)` called → **ignored** (promise already rejected)

The `onError` callback from React's RSC renderer fires **before** the error propagates through the stream and back to the router. So `reject()` is called before `resolve()`, and the except handler's response is discarded.

### Why the existing e2e test passes

The `/debug/throw` route uses `() => { throw new Error("...") }` — a **function** handler, not a component. `isRouteComponent` returns false for this handler (no JSX in toString), so it goes through the direct-call path (`componentHandler(getRequestInfo())`), not through `renderPage`. The throw is caught synchronously by the try/catch, with no `onError` race condition.

### Why the user's setup triggers the bug

The user has `render(Document, [route("/", Home)])` where `Home` is a component that throws. Since `Home` is a proper React component (contains JSX), `isRouteComponent` returns true, and it goes through `renderPage` → RSC stream → `onError` race condition.

## Implementation

The fix evolved through three iterations as we discovered additional constraints.

### Iteration 1: `onError` as no-op (insufficient)

Initial attempt: remove the `new Promise` wrapper and make `onError` a no-op. The theory was that errors propagate through the RSC stream naturally, causing `renderPage` to throw, which the router catches.

**Finding**: `onError` is sometimes the ONLY signal for rendering errors. React's RSC/SSR renderers may encode errors in the stream without always causing `renderDocumentHtmlStream` to reject. Making `onError` a no-op silently swallowed some errors.

### Iteration 2: Capture and re-throw (RSC state corruption)

Second attempt: capture errors in `onError`, then throw from `renderPage` after `renderDocumentHtmlStream` returns (or in a catch block if it throws).

**Finding**: Throwing from `renderPage` (even catching and re-throwing from the try/catch) corrupts React's internal RSC stream state. Subsequent `renderPage` calls (e.g., for the except handler's error page) fail with `chunk.reason.enqueueModel is not a function`. The tee'd RSC streams left in a half-consumed state interfere with React's internal bookkeeping.

### Iteration 3: Side-channel error signaling (final fix)

Three-part fix:

1. **`renderPage` captures errors on `rw.renderError`** (`worker.tsx`): Instead of throwing, `renderPage` stores the error on the `RwContext`. When `renderDocumentHtmlStream` throws AND `rw.renderError` is set, we catch the throw and return a minimal `new Response(null, { status: 500 })`. This keeps `renderPage` from throwing, avoiding RSC state corruption.

2. **Router checks `rw.renderError` after `renderPage`** (`router.ts`): After `renderPage` returns, the router checks `requestInfo.rw.renderError`. If set, it clears it and throws, routing to except handlers. The except handler's `renderPage` call starts with clean state (`rw.renderError = undefined`).

3. **`pageRouteResolved` resolved in error path** (`router.ts`): Prevents the worker from hanging on `await rw.pageRouteResolved?.promise` when an error is handled by except handlers.

4. **Removed the `new Promise` wrapper** (`worker.tsx`): The outer promise with `onError: reject` is replaced with a direct `router.handle` call. `onError` is now `() => {}` at the worker level (the local `onError` in `renderPage` is what captures errors).

### Files changed

- `sdk/src/runtime/worker.tsx` — Removed Promise wrapper; renderPage captures errors on `rw.renderError`; catches `renderDocumentHtmlStream` throws
- `sdk/src/runtime/lib/router.ts` — Checks `rw.renderError` after renderPage; resolves `pageRouteResolved` in error path
- `sdk/src/runtime/lib/types.ts` — Added `renderError?: unknown` to `RwContext`
- `playground/kitchen-sink/src/app/pages/ThrowingComponent.tsx` — New throwing component
- `playground/kitchen-sink/src/worker.tsx` — Added `/debug/throw-component` route
- `playground/kitchen-sink/__tests__/e2e.test.mts` — E2e test for component error handling

## Verification

All 51 router unit tests pass.

E2e verification:
1. **With fix**: "except handler catches errors from component route handlers" passes (all 8 dev tests pass)
2. **Without fix** (git stash): 4 failures including the new component test
3. **With fix re-applied** (git stash pop): new component test passes; remaining failures are pre-existing flaky tests

### Full verification matrix

| Run | Environment | Our test | Other failures | Notes |
|-----|-------------|----------|----------------|-------|
| 1 | dev | PASS | 0 | Clean run |
| 2 | dev (no fix) | FAIL | 3 | Confirms repro |
| 3 | dev | PASS | 3 (flaky) | uncaught/async/client-components |
| 4 | deploy | PASS | 3 (flaky) | Same flaky set |
| 5 | dev | PASS | 0 | Clean run |
| 6 | deploy | PASS | 5 (flaky) | Inc. "Hello World" — infra flakiness |
| main baseline | dev | N/A | 1 (client-components) | Pre-existing |

Our test passes consistently in every run (5/5 with fix, 0/1 without). Other failures are inconsistent, include tests unrelated to error handling ("Hello World", RSC kitchen-sink), and the "client components" failure is pre-existing on main.

## Finalization

### Decisions Made
- **Side-channel error signaling via `rw.renderError`**: Chose this over throwing from `renderPage` because throwing corrupts React's internal RSC flight client state. The side-channel approach lets `renderPage` return cleanly, preserving state for the except handler's render.
- **`renderError` on RwContext**: Added as an optional field rather than a separate mechanism. Keeps the error close to the rendering context that produced it.
- **Catch `renderDocumentHtmlStream` throws**: When `rw.renderError` is already set, we catch the throw and return a minimal 500 Response instead of re-throwing. The router detects `rw.renderError` and routes to except handlers.

### Assumptions
- `rw.renderError` is only set during `renderPage` and checked immediately after by the router. No other code reads it.
- The except handler's `renderPage` call starts with clean state (`rw.renderError = undefined`).

### Hurdles Encountered
1. **`onError` as no-op**: Insufficient — React's RSC sometimes uses `onError` as the only error signal.
2. **Capture and re-throw**: Corrupted React's RSC stream state (`chunk.reason.enqueueModel is not a function`).
3. **Side-channel approach**: Works correctly. Took 3 iterations to get here.

### Open Questions
- The "uncaught errors" and "async errors" e2e tests are flaky across all branches. Separate investigation may be warranted.

### Commit Log
- `6e997f0bc` — Fix except handler not returning error page for component errors (#1065)
