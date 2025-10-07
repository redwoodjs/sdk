import { counter, initializeCounter } from "./counterState.js";

export function CounterServer() {
  // Generate a unique request ID for this server render
  const requestId = crypto.randomUUID();

  // Initialize the counter for this request
  initializeCounter(requestId);

  // Perform some operations to demonstrate state isolation
  const initialValue = counter.getValue();
  const afterIncrement = counter.increment();
  const afterAnotherIncrement = counter.increment();
  const afterDecrement = counter.decrement();

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2>Server-Side Counter Demo</h2>
      <p>Request ID: {requestId}</p>

      <div style={{ marginTop: "20px" }}>
        <p>Initial Value: {initialValue}</p>
        <p>After Increment: {afterIncrement}</p>
        <p>After Another Increment: {afterAnotherIncrement}</p>
        <p>After Decrement: {afterDecrement}</p>
        <p>Final Value: {counter.getValue()}</p>
      </div>

      <div
        style={{
          marginTop: "20px",
          padding: "10px",
          backgroundColor: "#e8f4f8",
        }}
      >
        <h3>Server-Side State Isolation:</h3>
        <p>
          This demonstrates that each server render gets its own isolated
          counter instance. The counter state is maintained throughout the
          server-side rendering process but is isolated from other concurrent
          requests.
        </p>
      </div>
    </div>
  );
}
