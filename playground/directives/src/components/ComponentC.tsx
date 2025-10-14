"use client";

import { useState } from "react";

export function ComponentC() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ border: "2px solid green", padding: "1rem", margin: "1rem 0" }}>
      <h4>Component C (Client Component)</h4>
      <p>This component also has the "use client" directive.</p>
      <p>It uses React hooks (useState) to demonstrate client-side functionality.</p>
      
      <div>
        <p>Count: {count}</p>
        <button onClick={() => setCount(count + 1)}>
          Increment
        </button>
        <button onClick={() => setCount(0)}>
          Reset
        </button>
      </div>
    </div>
  );
}
