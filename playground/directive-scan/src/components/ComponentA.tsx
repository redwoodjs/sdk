// Initially a server component - no "use client" directive
// This will be modified during the test to import ComponentB

// import { ComponentB } from "./ComponentB";

export function ComponentA() {
  return (
    <div>
      <h2>Component A (Server Component)</h2>
      <p>This is initially a server component.</p>
      <p>During the test, we'll modify this to import ComponentB.</p>

      {/* TODO: Uncomment this line to test the missing link scenario */}
      {/* <ComponentB /> */}
    </div>
  );
}
