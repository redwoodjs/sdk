"use client";

import { UserPresence } from "@/app/components/UserPresence";
import { AppContext } from "@/worker";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Home({ ctx }: { ctx: AppContext }) {
  const [userCount, setUserCount] = useSyncedState(0, "user:counter");
  const [count, setCount] = useSyncedState(0, "counter");
  const [globalState] = useSyncedState<Record<string, unknown>>({}, "STATE");

  const isLoggedIn = ctx.userId !== null;

  return (
    <div className="container">
      <h1>Synced State Test</h1>

      <div className="section">
        <div
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            backgroundColor: "#f0f0f0",
            borderRadius: "4px",
          }}
        >
          <h2 style={{ margin: "0 0 0.5rem 0" }}>
            Current User ID: {ctx.userId || "Not logged in"}
          </h2>
          {isLoggedIn ? (
            <a
              href="/logout"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                backgroundColor: "#dc3545",
                color: "white",
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              Logout
            </a>
          ) : (
            <a
              href="/login"
              style={{
                display: "inline-block",
                padding: "0.5rem 1rem",
                backgroundColor: "#28a745",
                color: "white",
                textDecoration: "none",
                borderRadius: "4px",
              }}
            >
              Log In
            </a>
          )}
        </div>

        {/* Allow the user to set a unique ID, this will refresh the entire page and add the userId to the context */}
        <details style={{ marginBottom: "1rem" }}>
          <summary>Set User ID (for testing)</summary>
          <ol>
            <li>
              <a href="/?userId=123">123</a>
            </li>
            <li>
              <a href="/?userId=456">456</a>
            </li>
          </ol>
        </details>

        {isLoggedIn ? (
          <>
            <h2>User Counter</h2>
            <div className="counter-display">Count: {userCount}</div>
            <div className="button-group">
              <button onClick={() => setUserCount((c) => c + 1)}>
                Increment
              </button>
              <button onClick={() => setUserCount((c) => c - 1)}>
                Decrement
              </button>
              <button onClick={() => setUserCount(0)}>Reset</button>
            </div>
          </>
        ) : (
          <>
            <h2>User Counter</h2>
            <div className="counter-display" style={{ opacity: 0.5 }}>
              Count: {userCount} (disabled - please log in)
            </div>
            <div className="button-group">
              <button disabled>Increment</button>
              <button disabled>Decrement</button>
              <button disabled>Reset</button>
            </div>
          </>
        )}

        <h2>Global Counter</h2>
        <div className="counter-display">Count: {count}</div>
        <div className="button-group">
          <button onClick={() => setCount((c) => c + 1)}>Increment</button>
          <button onClick={() => setCount((c) => c - 1)}>Decrement</button>
          <button onClick={() => setCount(0)}>Reset</button>
        </div>

        {/* Use key prop to force remount on login state change, ensuring unsubscribe/resubscribe */}
        <UserPresence
          key={isLoggedIn ? "logged-in" : "logged-out"}
          isLoggedIn={isLoggedIn}
          currentUserId={ctx.userId}
        />

        {/* Validation section showing the global STATE object */}
        <details style={{ marginTop: "2rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
            Handler Validation: Global STATE Object
          </summary>
          <div
            style={{
              marginTop: "1rem",
              padding: "1rem",
              backgroundColor: "#f9f9f9",
              borderRadius: "4px",
              border: "1px solid #ddd",
            }}
          >
            <h3 style={{ margin: "0 0 0.5rem 0" }}>
              All State Keys (from setStateHandler/getStateHandler)
            </h3>
            <pre
              style={{
                margin: 0,
                padding: "0.5rem",
                backgroundColor: "#fff",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "0.875rem",
                maxHeight: "400px",
              }}
            >
              {JSON.stringify(globalState, null, 2)}
            </pre>
            <p
              style={{
                margin: "0.5rem 0 0 0",
                fontSize: "0.875rem",
                color: "#666",
              }}
            >
              This object is updated by setStateHandler and getStateHandler to
              validate that the handlers are working correctly.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
