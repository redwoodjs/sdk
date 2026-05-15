import { ComponentB } from "./ComponentB.js";

export function ComponentA() {
  return (
    <div>
      <p>Component A</p>
      <ComponentB />
    </div>
  );
}
