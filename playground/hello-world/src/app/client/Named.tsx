"use client";

import { useState } from "react";

export function NamedButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount((c) => c + 1)}>Named count: {count}</button>;
}

export function NamedLabel() {
  return <span data-proof="named-label">Named label durable HMR</span>;
}

export function HmrAddedProof() {
  return <span data-proof="hmr-added-proof">HMR added export</span>;
}

export function HmrSecondProof() {
  return <span data-proof="hmr-second-proof">HMR second export</span>;
}

export function HmrFourthProof() {
  return <span data-proof="hmr-fourth-proof">HMR fourth export</span>;
}

export function DurableHmrProof() {
  return <span data-proof="durable-hmr-proof">Durable HMR export</span>;
}

export function DurableHmrProof2() {
  return <span data-proof="durable-hmr-proof-2">Durable HMR export 2</span>;
}
