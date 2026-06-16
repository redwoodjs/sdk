"use client";

import { useState } from "react";
import {
  createSyncedStateHook,
  type SyncedStateStatus,
} from "rwsdk/use-synced-state/client";

const STATUS_LABELS: Record<SyncedStateStatus, string> = {
  connected: "Connected",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting...",
};

export function ConnectionStatus() {
  const [status, setStatus] = useState<SyncedStateStatus>("connected");

  const useSyncedState = createSyncedStateHook({
    onStatusChange: setStatus,
  });

  // Subscribe to a dummy key just to keep a WebSocket session alive.
  useSyncedState(null, "__connection_probe");

  return (
    <div data-testid="connection-status">
      WebSocket: {STATUS_LABELS[status]}
    </div>
  );
}
