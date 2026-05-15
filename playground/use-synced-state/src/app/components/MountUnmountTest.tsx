"use client";

import { useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

/**
 * A component that can be mounted/unmounted to test unsubscribe functionality.
 * This component uses useSyncedState and can be toggled on/off to verify
 * that unsubscribe handlers are called when the component unmounts.
 */
function TestComponent({ testKey }: { testKey: string }) {
  const [value, setValue] = useSyncedState(0, testKey);

  return (
    <div
      style={{
        padding: "1rem",
        backgroundColor: "#fff3cd",
        borderRadius: "4px",
        border: "2px solid #ffc107",
        marginTop: "1rem",
      }}
    >
      <h3 style={{ margin: "0 0 0.5rem 0" }}>
        Test Component (Key: {testKey})
      </h3>
      <p style={{ margin: "0 0 0.5rem 0", fontSize: "0.875rem" }}>
        This component is currently mounted. Check the console for
        registerUnsubscribeHandler logs when you unmount it.
      </p>
      <div className="counter-display">Value: {value}</div>
      <div className="button-group" style={{ marginTop: "0.5rem" }}>
        <button onClick={() => setValue((v) => v + 1)}>Increment</button>
        <button onClick={() => setValue((v) => v - 1)}>Decrement</button>
        <button onClick={() => setValue(0)}>Reset</button>
      </div>
    </div>
  );
}

export function MountUnmountTest() {
  const [isMounted, setIsMounted] = useState(false);
  const [testKey] = useState(() => `mount-test-${Date.now()}`);

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1rem",
        backgroundColor: "#e3f2fd",
        borderRadius: "4px",
        border: "1px solid #2196f3",
      }}
    >
      <h2 style={{ margin: "0 0 1rem 0" }}>Mount/Unmount Test</h2>
      <p style={{ margin: "0 0 1rem 0", fontSize: "0.875rem" }}>
        Use this component to test that unsubscribe handlers are called when a
        component unmounts. Mount the component, then unmount it and check the
        console for registerUnsubscribeHandler logs.
      </p>
      <div className="button-group">
        <button
          onClick={() => setIsMounted(true)}
          disabled={isMounted}
          style={{
            backgroundColor: isMounted ? "#ccc" : "#28a745",
            color: "white",
            cursor: isMounted ? "not-allowed" : "pointer",
          }}
        >
          Mount Component
        </button>
        <button
          onClick={() => setIsMounted(false)}
          disabled={!isMounted}
          style={{
            backgroundColor: !isMounted ? "#ccc" : "#dc3545",
            color: "white",
            cursor: !isMounted ? "not-allowed" : "pointer",
          }}
        >
          Unmount Component
        </button>
      </div>
      {isMounted && <TestComponent testKey={testKey} />}
      {!isMounted && (
        <p
          style={{
            margin: "1rem 0 0 0",
            fontSize: "0.875rem",
            color: "#666",
            fontStyle: "italic",
          }}
        >
          Component is unmounted. Check the console for unsubscribe handler
          logs.
        </p>
      )}
    </div>
  );
}
