"use client";

import "./SideEffectCssComponent.css";

export function SideEffectCssComponent() {
  return (
    <div className="side-effect-content" data-testid="side-effect-content">
      <h1>Side-Effect CSS Import</h1>
      <p>This component tests side-effect CSS imports in a client component.</p>
    </div>
  );
}
