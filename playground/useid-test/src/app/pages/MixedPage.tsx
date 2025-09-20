import { useId } from "react";
import { ClientUseIdComponent } from "../components/ClientUseIdComponent.js";

export default function MixedPage() {
  const serverId1 = useId();
  const serverId2 = useId();

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1 style={{ marginBottom: "1rem" }}>Mixed Server/Client useId Test</h1>
      <p style={{ marginBottom: "2rem", color: "#333" }}>
        This page combines server components (using `useId`) with client
        components (also using `useId`). The server IDs should be stable, and
        client IDs should hydrate consistently.
      </p>

      {/* Server Components */}
      <div
        id={serverId1}
        data-testid="mixed-server-component-1"
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
          Server ID:{" "}
          <strong data-testid="mixed-server-id-1">{serverId1}</strong>
        </p>
      </div>

      {/* Client Component */}
      <ClientUseIdComponent title="Client Component (Embedded in Server Page)" />

      {/* Another Server Component */}
      <div
        id={serverId2}
        data-testid="mixed-server-component-2"
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
          Server Component 2
        </h2>
        <p style={{ margin: 0 }}>
          Server ID:{" "}
          <strong data-testid="mixed-server-id-2">{serverId2}</strong>
        </p>
      </div>

      {/* Another Client Component */}
      <ClientUseIdComponent title="Second Client Component" />

      <div
        style={{
          marginTop: "2rem",
          padding: "1rem",
          backgroundColor: "#f3e5f5",
          borderRadius: "4px",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9rem", color: "#7b1fa2" }}>
          ✓ This page tests the interaction between server and client components
          using `useId`. Server IDs (green) should be stable, client IDs
          (orange) should hydrate consistently.
        </p>
      </div>
    </div>
  );
}
