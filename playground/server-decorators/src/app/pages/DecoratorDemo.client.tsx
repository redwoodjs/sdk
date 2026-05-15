"use client";

import { useState } from "react";
import { greetUser } from "../actions";

export function DecoratorDemo() {
  const [result, setResult] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleGreet = async () => {
    if (!name.trim()) return;

    try {
      setIsLoading(true);
      const response = await greetUser(name);
      setResult(response);
    } catch (error) {
      setResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "500px" }}>
      <h2>Server Decorator Demo</h2>
      <p>Demonstrates <code>@Transform()</code> and <code>@TransformParam()</code> decorators.</p>

      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <input
          id="name-input"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !isLoading && name.trim()) {
              handleGreet();
            }
          }}
          placeholder="Enter name"
          disabled={isLoading}
          style={{
            padding: "8px 12px",
            flex: 1,
            fontSize: "16px",
            border: "1px solid #ccc",
            borderRadius: "4px",
          }}
        />

        <button
          id="greet-button"
          onClick={handleGreet}
          disabled={isLoading || !name.trim()}
          style={{
            padding: "8px 20px",
            fontSize: "16px",
            backgroundColor: isLoading || !name.trim() ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isLoading || !name.trim() ? "not-allowed" : "pointer",
          }}
        >
          {isLoading ? "..." : "Greet"}
        </button>
      </div>

      {result && (
        <div
          id="decorator-result"
          style={{
            marginTop: "20px",
            padding: "12px",
            backgroundColor: "#f9f9f9",
            border: "1px solid #ddd",
            borderRadius: "4px",
            fontFamily: "monospace",
          }}
        >
          {result}
        </div>
      )}
    </div>
  );
}
