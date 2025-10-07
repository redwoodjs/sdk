import { useState } from "react";
import { counter, initializeCounter } from "./counterState.js";

export function CounterDemo() {
  const [localCount, setLocalCount] = useState(0);
  const [requestId] = useState(() => crypto.randomUUID());

  const handleInitialize = () => {
    initializeCounter(requestId);
    setLocalCount(counter.getValue());
  };

  const handleIncrement = () => {
    if (counter) {
      const newValue = counter.increment();
      setLocalCount(newValue);
    }
  };

  const handleDecrement = () => {
    if (counter) {
      const newValue = counter.decrement();
      setLocalCount(newValue);
    }
  };

  const handleReset = () => {
    if (counter) {
      counter.reset();
      setLocalCount(0);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Request-Scoped Counter Demo</h2>
      <p>Request ID: {requestId}</p>
      <p>Counter Value: {localCount}</p>

      <div style={{ marginTop: "20px" }}>
        <button onClick={handleInitialize} style={{ marginRight: "10px" }}>
          Initialize Counter
        </button>
        <button onClick={handleIncrement} style={{ marginRight: "10px" }}>
          Increment
        </button>
        <button onClick={handleDecrement} style={{ marginRight: "10px" }}>
          Decrement
        </button>
        <button onClick={handleReset}>Reset</button>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          backgroundColor: "#f0f0f0",
        }}
      >
        <h3>Instructions:</h3>
        <ol>
          <li>
            Click "Initialize Counter" to set up the request-scoped counter
          </li>
          <li>Use the increment/decrement buttons to modify the counter</li>
          <li>Each request gets its own isolated counter instance</li>
          <li>Open multiple tabs to see isolation between requests</li>
        </ol>
      </div>
    </div>
  );
}
