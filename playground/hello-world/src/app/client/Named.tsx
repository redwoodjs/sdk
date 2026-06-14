"use client";

import { useState } from "react";

export function NamedButton() {
  const [count, setCount] = useState(0);
  return (
    <button
      data-proof="named-button"
      id="named-count"
      onClick={() => setCount((c) => c + 1)}
    >
      Named count: {count}
    </button>
  );
}

export function NamedLabel() {
  return <span data-proof="named-label">Named label</span>;
}
