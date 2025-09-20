import { useId } from "react";

export default function ServerOnlyPage() {
  const id1 = useId();
  const id2 = useId();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>Server-Only useId Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This page uses `useId` in server components only. No client-side
        hydration should occur.
      </p>

      <div
        id={id1}
        data-testid="server-component-1"
        style={{
          padding: "1rem",
          border: "2px solid #4CAF50",
          borderRadius: "4px",
          marginBottom: "1rem",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            margin: "0 0 0.5rem 0",
            color: "#4CAF50",
          }}
        >
          Server Component 1
        </h2>
        <p style={{ margin: 0 }}>
          Server ID: <strong data-testid="server-id-1">{id1}</strong>
        </p>
      </div>

      <div
        id={id2}
        data-testid="server-component-2"
        style={{
          padding: "1rem",
          border: "2px solid #4CAF50",
          borderRadius: "4px",
          backgroundColor: "#f8f9fa",
        }}
      >
        <h2
          style={{
            fontSize: "1.25rem",
            margin: "0 0 0.5rem 0",
            color: "#4CAF50",
          }}
        >
          Server Component 2
        </h2>
        <p style={{ margin: 0 }}>
          Server ID: <strong data-testid="server-id-2">{id2}</strong>
        </p>
      </div>

      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#e8f5e8",
          borderRadius: "4px",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#2e7d32" }}>
          ✓ This page contains only server components. IDs should be stable and
          not change after page load.
        </p>
      </div>
    </div>
  );
}
