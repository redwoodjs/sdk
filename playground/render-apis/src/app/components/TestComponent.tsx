import { useId } from "react";

export function TestComponent({
  title,
  type,
}: {
  title: string;
  type: "server" | "client";
}) {
  const id = useId();

  return (
    <div
      data-testid={`test-component-${type}`}
      style={{
        padding: "1rem",
        border: `2px solid ${type === "server" ? "#4CAF50" : "#2196F3"}`,
        borderRadius: "4px",
        marginBottom: "1rem",
        backgroundColor: "#f8f9fa",
      }}
    >
      <h2
        style={{
          fontSize: "1.25rem",
          margin: "0 0 0.5rem 0",
          color: type === "server" ? "#4CAF50" : "#2196F3",
        }}
      >
        {title}
      </h2>
      <p style={{ margin: "0 0 0.5rem 0" }}>
        Component Type:{" "}
        <strong data-testid={`component-type-${type}`}>{type}</strong>
      </p>
      <p style={{ margin: 0 }}>
        Generated ID: <strong data-testid={`component-id-${type}`}>{id}</strong>
      </p>
    </div>
  );
}
