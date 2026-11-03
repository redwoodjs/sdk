"use client";

import { useState } from "react";

export function NonDivWidget() {
  const [clicks, setClicks] = useState(0);

  return (
    <>
      <a href="#main-content">Skip to content</a>
      <main id="main-content">
        <h1>Non-div Widget Page</h1>
        <button
          id="non-div-widget-button"
          type="button"
          onClick={() => setClicks((count) => count + 1)}
        >
          Clicks: {clicks}
        </button>
      </main>
    </>
  );
}
