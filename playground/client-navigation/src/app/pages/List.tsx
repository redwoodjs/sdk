import { Suspense } from "react";
import type { RequestInfo } from "rwsdk/worker";
import { Toggle } from "./Toggle";

// Minimal repro for the "navigate() commit lag under CPU starvation" bug.
//
// The server render depends only on the `?v` search param so the sole variable
// under test is the client-side commit path: navigate() -> fetch ?__rsc ->
// setRscPayload (startTransition) -> React.use commit.
//
// `?v=a` renders one "primary" row and a heading "a"; `?v=b` renders two and a
// heading "b". The heading carries data-testid="current-v" so the test can
// compare the committed DOM against the URL.
//
// To recreate the conditions of the downstream list page that surfaced the bug
// (a non-trivial tree + a streamed Suspense boundary), we also render a large
// list of rows and an async section behind <Suspense>. This widens the
// concurrent-render/commit window so the interruptible transition that carries
// the new payload has a chance to be deprioritized under CPU starvation.

const ROW_COUNT = 6000;

async function SlowSection({ v }: { v: string }) {
  // Yield once so this renders as a streamed Suspense chunk in the RSC payload
  // rather than inline, exercising the multi-chunk commit path.
  await new Promise((resolve) => setTimeout(resolve, 0));
  return (
    <ul data-testid="rows">
      {Array.from({ length: ROW_COUNT }, (_, i) => (
        <li key={i} data-testid={`row-${v}-${i}`}>
          {v}-{i}
        </li>
      ))}
    </ul>
  );
}

export function List({ request }: RequestInfo) {
  const url = new URL(request.url);
  const v = url.searchParams.get("v") === "b" ? "b" : "a";
  const primary = v === "b" ? ["row-1", "row-2"] : ["row-1"];

  return (
    <div>
      <h1 data-testid="current-v" id="current-v">
        {v}
      </h1>
      <Toggle v={v} />
      <ul data-testid="primary-rows">
        {primary.map((row) => (
          <li key={row} data-testid={row}>
            {row}
          </li>
        ))}
      </ul>
      <Suspense fallback={<p data-testid="loading">loading…</p>}>
        <SlowSection v={v} />
      </Suspense>
    </div>
  );
}
