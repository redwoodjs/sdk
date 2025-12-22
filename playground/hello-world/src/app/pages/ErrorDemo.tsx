"use client";

// Example component that demonstrates error handling
export function ErrorDemo() {
  return (
    <div
      style={{ marginTop: "2rem", padding: "1rem", border: "1px solid #ccc" }}
    >
      <h2>Error Handling Demo</h2>
      <p>
        These buttons trigger different types of errors to demonstrate the error
        handling APIs configured in <code>client.tsx</code>.
      </p>
      <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
        <UncaughtErrorButton />
        <AsyncErrorButton />
      </div>
    </div>
  );
}

// Component that throws an error in an event handler (uncaught error)
function UncaughtErrorButton() {
  const handleClick = () => {
    const err = new Error("This is an uncaught error from an event handler");
    throw err;
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: "0.5rem 1rem",
        backgroundColor: "#ff4444",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Trigger Uncaught Error
    </button>
  );
}

// Component that throws an error in an async operation (uncaught error)
function AsyncErrorButton() {
  const handleClick = () => {
    setTimeout(() => {
      throw new Error("This is an uncaught async error");
    }, 100);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: "0.5rem 1rem",
        backgroundColor: "#ff8844",
        color: "white",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
      }}
    >
      Trigger Async Error
    </button>
  );
}
