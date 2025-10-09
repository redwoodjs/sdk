"use client";

import { ComponentC } from "./ComponentC";

export function ComponentB() {
  return (
    <div style={{ border: "2px solid blue", padding: "1rem", margin: "1rem 0" }}>
      <h3>Component B (Client Component)</h3>
      <p>This component has the "use client" directive.</p>
      <p>It also imports ComponentC, which also has "use client".</p>
      
      <ComponentC />
    </div>
  );
}
