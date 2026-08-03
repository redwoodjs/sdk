"use client";

import { navigate } from "rwsdk/client";

// Toggles the `?v` param via navigate(). A plain <button> with no debounce or
// blur handling, so the repro exercises navigate() directly.
export function Toggle({ v }: { v: string }) {
  const next = v === "a" ? "b" : "a";
  return (
    <button
      data-testid="toggle"
      id="toggle"
      onClick={() => navigate(`/list?v=${next}`)}
    >
      toggle
    </button>
  );
}
