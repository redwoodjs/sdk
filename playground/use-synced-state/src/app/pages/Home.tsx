"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Home() {
  const [count, setCount] = useSyncedState(0, "counter");
  const [message, setMessage] = useSyncedState("", "message");

  return (
    <div className="container">
      <h1>Synced State Test</h1>

      <div className="section">
        <h2>Counter</h2>
        <div className="counter-display">Count: {count}</div>
        <div className="button-group">
          <button onClick={() => setCount((c) => c + 1)}>Increment</button>
          <button onClick={() => setCount((c) => c - 1)}>Decrement</button>
          <button onClick={() => setCount(0)}>Reset</button>
        </div>
      </div>

      <div className="section">
        <h2>Message</h2>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
        />
        <div className="message-display">
          {message || <span style={{ color: "#999" }}>No message yet</span>}
        </div>
      </div>
    </div>
  );
}
