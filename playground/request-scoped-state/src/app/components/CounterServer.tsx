import { counter } from "../../lib/counterState.js";

export function CounterServer() {
  // Each request gets a new counter instance
  const initialValue = counter.getValue();
  counter.increment();
  const afterIncrement = counter.getValue();
  counter.increment();
  const afterAnotherIncrement = counter.getValue();
  counter.decrement();
  const afterDecrement = counter.getValue();
  const finalValue = counter.getValue();
  const requestId = counter.getId();

  return (
    <div>
      <h2>Server-Side Counter</h2>
      <p>Request ID: {requestId}</p>
      <br />
      <p>Initial Value: {initialValue}</p>
      <p>After Increment: {afterIncrement}</p>
      <p>After Another Increment: {afterAnotherIncrement}</p>
      <p>After Decrement: {afterDecrement}</p>
      <p>Final Value: {finalValue}</p>
    </div>
  );
}
