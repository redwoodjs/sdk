"use client";

import { useSyncedState } from "rwsdk/use-synced-state/client";

export function UserPresence({ isLoggedIn }: { isLoggedIn: boolean }) {
  // Always subscribe to "presence" to see the list
  // The component will remount when isLoggedIn changes (via key prop),
  // which will trigger unsubscribe/resubscribe and update the presence list
  const [presence] = useSyncedState<string[]>([], "presence");

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1rem",
        backgroundColor: "#e8f5e9",
        borderRadius: "4px",
      }}
    >
      <h2 style={{ margin: "0 0 0.5rem 0" }}>Online Users</h2>
      {presence.length === 0 ? (
        <p style={{ margin: 0, color: "#666" }}>No users online</p>
      ) : (
        <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
          {presence.map((userId) => (
            <li key={userId}>{userId}</li>
          ))}
        </ul>
      )}
      <p
        style={{ margin: "0.5rem 0 0 0", fontSize: "0.875rem", color: "#666" }}
      >
        Total: {presence.length}
      </p>
    </div>
  );
}
