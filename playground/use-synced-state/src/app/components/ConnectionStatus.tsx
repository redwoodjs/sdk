"use client";

import { useState } from "react";
import { createSyncedStateHook } from "rwsdk/use-synced-state/client";
import type { SyncedStateStatus } from "rwsdk/use-synced-state/client";

const STATUS_STYLES: Record<
  SyncedStateStatus,
  { bg: string; border: string; text: string; label: string }
> = {
  connected: {
    bg: "#e8f5e9",
    border: "#4caf50",
    text: "#2e7d32",
    label: "Connected",
  },
  disconnected: {
    bg: "#ffebee",
    border: "#f44336",
    text: "#c62828",
    label: "Disconnected",
  },
  reconnecting: {
    bg: "#fff3e0",
    border: "#ff9800",
    text: "#e65100",
    label: "Reconnecting...",
  },
};

/**
 * Demonstrates the onStatusChange callback by showing a live connection
 * status indicator. Uses createSyncedStateHook to register the callback.
 */
export function ConnectionStatus() {
  const [status, setStatus] = useState<SyncedStateStatus>("connected");

  // Create a hook instance with the status callback wired up.
  // We call useSyncedState here so the effect registers the listener.
  const useSyncedState = createSyncedStateHook({
    onStatusChange: setStatus,
  });

  // Subscribe to a dummy key just to activate the connection & listener
  useSyncedState(null, "__connection_probe");

  const style = STATUS_STYLES[status];

  return (
    <div
      style={{
        padding: "0.75rem 1rem",
        backgroundColor: style.bg,
        border: `2px solid ${style.border}`,
        borderRadius: "4px",
        marginBottom: "1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: "50%",
          backgroundColor: style.border,
          display: "inline-block",
        }}
      />
      <span style={{ color: style.text, fontWeight: 600 }}>
        WebSocket: {style.label}
      </span>
    </div>
  );
}
