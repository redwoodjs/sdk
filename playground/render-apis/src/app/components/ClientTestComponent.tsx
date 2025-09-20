"use client";

import { useId, useEffect, useState } from "react";

export function ClientTestComponent({ title }: { title: string }) {
  const id = useId();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div
      data-testid="client-test-component"
      style={{
        padding: "1rem",
        border: "2px solid #FF9800",
        borderRadius: "4px",
        marginBottom: "1rem",
        backgroundColor: "#fff8e1",
      }}
    >
      <h3
        style={{
          fontSize: "1.1rem",
          margin: "0 0 0.5rem 0",
          color: "#FF9800",
        }}
      >
        {title}
      </h3>
      <p style={{ margin: "0 0 0.5rem 0" }}>
        Component Type:{" "}
        <strong data-testid="client-component-type">client</strong>
      </p>
      <p style={{ margin: "0 0 0.5rem 0" }}>
        Generated ID: <strong data-testid="client-component-id">{id}</strong>
      </p>
      <p style={{ margin: 0, fontSize: "0.9rem" }}>
        Status:{" "}
        <span
          data-testid="client-mount-status"
          style={{ color: mounted ? "#2e7d32" : "#ef6c00" }}
        >
          {mounted ? "Mounted" : "Mounting..."}
        </span>
      </p>
    </div>
  );
}
