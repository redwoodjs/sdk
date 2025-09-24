"use client";

import { useId, useEffect, useState } from "react";

export function ClientUseIdComponent({
  title,
  testIdPrefix = "mixed",
}: {
  title: string;
  testIdPrefix?: string;
}) {
  const id1 = useId();
  const id2 = useId();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  return (
    <div
      data-testid={`${testIdPrefix}-client-component`}
      style={{
        padding: "1rem",
        border: "2px solid #FF9800",
        borderRadius: "4px",
        marginBottom: "1rem",
        backgroundColor: "#fff8e1",
      }}
    >
      <h3
        style={{ fontSize: "1.1rem", margin: "0 0 1rem 0", color: "#FF9800" }}
      >
        {title}
      </h3>

      <div style={{ marginBottom: "1rem" }}>
        <div
          id={id1}
          data-testid={`${testIdPrefix}-client-element-1`}
          style={{
            padding: "0.5rem",
            border: "1px solid #FFB74D",
            borderRadius: "2px",
            marginBottom: "0.5rem",
            backgroundColor: "#fff",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Client ID 1:{" "}
            <strong data-testid={`${testIdPrefix}-client-id-1`}>{id1}</strong>
          </p>
        </div>

        <div
          id={id2}
          data-testid={`${testIdPrefix}-client-element-2`}
          style={{
            padding: "0.5rem",
            border: "1px solid #FFB74D",
            borderRadius: "2px",
            backgroundColor: "#fff",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.9rem" }}>
            Client ID 2:{" "}
            <strong data-testid={`${testIdPrefix}-client-id-2`}>{id2}</strong>
          </p>
        </div>
      </div>

      <div
        data-testid={`${testIdPrefix}-hydration-status`}
        style={{
          padding: "0.5rem",
          backgroundColor: hydrated ? "#e8f5e8" : "#fff3e0",
          borderRadius: "2px",
          fontSize: "0.8rem",
        }}
      >
        <span style={{ color: hydrated ? "#2e7d32" : "#ef6c00" }}>
          {hydrated ? "✓ Hydrated" : "⏳ Hydrating..."}
        </span>
      </div>
    </div>
  );
}
