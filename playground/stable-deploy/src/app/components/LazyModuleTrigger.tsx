"use client";

import { lazy, Suspense, useState } from "react";

const RedeployLazyMessage = lazy(() => import("./RedeployLazyMessage"));

export function LazyModuleTrigger() {
  const [showLazyMessage, setShowLazyMessage] = useState(false);

  return (
    <section>
      <button
        data-testid="load-lazy-message"
        onClick={() => {
          setShowLazyMessage(true);
        }}
      >
        Load Lazy Message
      </button>

      {showLazyMessage ? (
        <Suspense fallback={<p>Loading lazy message...</p>}>
          <RedeployLazyMessage />
        </Suspense>
      ) : null}
    </section>
  );
}
