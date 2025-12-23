"use client";

import { useState } from "react";

export function Button() {
  const [count, setCount] = useState(0);
  return (
    <button id="client-button" onClick={() => setCount(count + 1)}>
      Client Count: {count}
    </button>
  );
}
