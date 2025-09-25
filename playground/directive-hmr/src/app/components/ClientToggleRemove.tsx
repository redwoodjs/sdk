"use client";

// This component starts as a Client Component.
// The test will remove "use client"; from it and verify HMR.

import { useState } from "react";

export function ClientToggleRemove() {
  const [count, setCount] = useState(0);

  return (
    <div data-testid="client-toggle-remove">
      <h2>Client Toggle Remove</h2>
      <p>Initial render: Client Component</p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <p data-testid="marker">Unchanged</p>
    </div>
  );
}
