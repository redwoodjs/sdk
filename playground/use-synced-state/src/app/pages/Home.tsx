"use client";

import { UserPresence } from "@/app/components/UserPresence";
import { AppContext } from "@/worker";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Home({ ctx }: { ctx: AppContext }) {
  const [userCount, setUserCount] = useSyncedState(0, "user:counter");
  const [count, setCount] = useSyncedState(0, "counter");

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
              <button onClick={() => setUserCount((c) => c + 1)}>Increment</button>
              <button onClick={() => setUserCount((c) => c - 1)}>Decrement</button>
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
        <UserPresence key={isLoggedIn ? "logged-in" : "logged-out"} isLoggedIn={isLoggedIn} currentUserId={ctx.userId} />
      </div>
    </div>
  );
}
