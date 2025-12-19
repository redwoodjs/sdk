"use client";

import { MountUnmountTest } from "@/app/components/MountUnmountTest";
import { UserPresence } from "@/app/components/UserPresence";
import { AppContext } from "@/worker";
import { useSyncedState } from "rwsdk/use-synced-state/client";

export function Home({ ctx }: { ctx: AppContext }) {
  const [userCount, setUserCount] = useSyncedState(0, "user:counter");
  const [count, setCount] = useSyncedState(0, "counter");
  const [shardedCount, setShardedCount] = useSyncedState(
    0,
    "counter",
    "my-room",
  );
  // Server-enforced private room: client requests "private", server transforms to "user:${userId}"
  const [privateCount, setPrivateCount] = useSyncedState(
    0,
    "counter",
    "private",
  );
  const [globalState] = useSyncedState<Record<string, unknown>>({}, "STATE");
  const [shardedGlobalState] = useSyncedState<Record<string, unknown>>(
    {},
    "STATE",
    "my-room",
  );
  const [privateGlobalState] = useSyncedState<Record<string, unknown>>(
    {},
    "STATE",
    "private",
  );

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

        <h2>Sharded Counter (Room: my-room)</h2>
        <div className="counter-display">Count: {shardedCount}</div>
        <div className="button-group">
          <button onClick={() => setShardedCount((c) => c + 1)}>
            Increment
          </button>
          <button onClick={() => setShardedCount((c) => c - 1)}>
            Decrement
          </button>
          <button onClick={() => setShardedCount(0)}>Reset</button>
        </div>

        {isLoggedIn ? (
          <>
            <h2>
              Private Counter (Server-enforced: private → user:{ctx.userId})
            </h2>
            <div className="counter-display">Count: {privateCount}</div>
            <div className="button-group">
              <button onClick={() => setPrivateCount((c) => c + 1)}>
                Increment
              </button>
              <button onClick={() => setPrivateCount((c) => c - 1)}>
                Decrement
              </button>
              <button onClick={() => setPrivateCount(0)}>Reset</button>
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#666",
                marginTop: "0.5rem",
              }}
            >
              This counter uses roomId "private" which the server transforms to
              "user:{ctx.userId}". Each user gets their own isolated Durable
              Object instance.
            </p>
          </>
        ) : (
          <>
            <h2>Private Counter</h2>
            <div className="counter-display" style={{ opacity: 0.5 }}>
              Count: {privateCount} (disabled - please log in)
            </div>
            <div className="button-group">
              <button disabled>Increment</button>
              <button disabled>Decrement</button>
              <button disabled>Reset</button>
            </div>
            <p
              style={{
                fontSize: "0.875rem",
                color: "#666",
                marginTop: "0.5rem",
              }}
            >
              Log in to see server-enforced room sharding in action.
            </p>
          </>
        )}

        {/* Use key prop to force remount on login state change, ensuring unsubscribe/resubscribe */}
        <UserPresence
          key={isLoggedIn ? "logged-in" : "logged-out"}
          isLoggedIn={isLoggedIn}
          currentUserId={ctx.userId}
        />

        {/* Mount/Unmount test component */}
        <MountUnmountTest />

        {/* Validation section showing the global STATE object */}
        <details style={{ marginTop: "2rem" }}>
          <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
            Handler Validation: Global STATE Objects
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
              Global Room State (from default DO)
            </h3>
            <pre
              style={{
                margin: "0 0 1rem 0",
                padding: "0.5rem",
                backgroundColor: "#fff",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "0.875rem",
                maxHeight: "200px",
              }}
            >
              {JSON.stringify(globalState, null, 2)}
            </pre>

            <h3 style={{ margin: "0 0 0.5rem 0" }}>
              Sharded Room State (from "my-room" DO)
            </h3>
            <pre
              style={{
                margin: "0 0 1rem 0",
                padding: "0.5rem",
                backgroundColor: "#fff",
                borderRadius: "4px",
                overflow: "auto",
                fontSize: "0.875rem",
                maxHeight: "200px",
              }}
            >
              {JSON.stringify(shardedGlobalState, null, 2)}
            </pre>

            {isLoggedIn && (
              <>
                <h3 style={{ margin: "0 0 0.5rem 0" }}>
                  Private Room State (from "user:{ctx.userId}" DO,
                  server-transformed from "private")
                </h3>
                <pre
                  style={{
                    margin: 0,
                    padding: "0.5rem",
                    backgroundColor: "#fff",
                    borderRadius: "4px",
                    overflow: "auto",
                    fontSize: "0.875rem",
                    maxHeight: "200px",
                  }}
                >
                  {JSON.stringify(privateGlobalState, null, 2)}
                </pre>
              </>
            )}

            <p
              style={{
                margin: "0.5rem 0 0 0",
                fontSize: "0.875rem",
                color: "#666",
              }}
            >
              These objects are updated by setStateHandler and getStateHandler
              on the server, showing that state is isolated per Durable Object
              instance. The private room demonstrates server-side room
              transformation.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
