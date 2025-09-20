"use client";

import { useId, useEffect, useState } from "react";

export default function ClientOnlyPage() {
  const id1 = useId();
  const id2 = useId();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>Client-Only useId Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This entire page is a client component. The `useId` hooks should
        generate consistent IDs during hydration.
      </p>

      <div
        id={id1}
        data-testid="client-component-1"
        style={{
          padding: "1rem",
          border: "2px solid #2196F3",
          borderRadius: "4px",
          marginBottom: "1rem",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            margin: "0 0 0.5rem 0",
            color: "#2196F3",
          }}
        >
          Client Component 1
        </h2>
        <p style={{ margin: 0 }}>
          Client ID: <strong data-testid="client-id-1">{id1}</strong>
        </p>
      </div>

      <div
        id={id2}
        data-testid="client-component-2"
        style={{
          padding: "1rem",
          border: "2px solid #2196F3",
          borderRadius: "4px",
          marginBottom: "1rem",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            margin: "0 0 0.5rem 0",
            color: "#2196F3",
          }}
        >
          Client Component 2
        </h2>
        <p style={{ margin: 0 }}>
          Client ID: <strong data-testid="client-id-2">{id2}</strong>
        </p>
      </div>

      <div
        data-testid="hydration-status"
        style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: hydrated ? "#e3f2fd" : "#fff3e0",
          borderRadius: "4px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "0.9rem",
            color: hydrated ? "#1565c0" : "#ef6c00",
          }}
        >
          {hydrated
            ? "✓ Client hydration complete"
            : "⏳ Waiting for hydration..."}
        </p>
      </div>
    </div>
  );
}
