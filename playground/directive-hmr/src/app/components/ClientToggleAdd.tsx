// This component starts as a Server Component.
// The test will add "use client"; to it and verify HMR.

import { useState } from "react";

export function ClientToggleAdd() {
  const [count, setCount] = useState(0);

  return (
    <div data-testid="client-toggle-add">
      <h2>Client Toggle Add</h2>
      <p>Initial render: Server Component</p>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <p data-testid="marker">Unchanged</p>
    </div>
  );
}
