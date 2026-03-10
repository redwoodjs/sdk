"use client";

import { useEffect, useRef, useState } from "react";
import { useSyncedState } from "rwsdk/use-synced-state/client";

/**
 * Reproduces PRZM's driver-location architecture:
 * - Server-side writes via HTTP -> DO stub -> setState (like mobile app GPS)
 * - Client-side reads via useSyncedState WebSocket subscription (like dispatcher live map)
 *
 * Start the ticker in one tab, watch another tab receive updates.
 * Deploy while running to test WebSocket disconnect behavior.
 */
export function ServerTickTest() {
  // --GROK--: Read-only subscription, mirrors PRZM's useDriverLocationSync pattern
  const [tick] = useSyncedState(0, "server-tick");
  const [running, setRunning] = useState(false);
  const [lastResponse, setLastResponse] = useState<string>("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!running) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // --GROK--: Simulates mobile app sending GPS updates via HTTP POST
    const doTick = async () => {
      try {
        const res = await fetch("/api/tick");
        const data = await res.json();
        setLastResponse(`OK: tick=${data.tick}`);
      } catch (err) {
        setLastResponse(`Error: ${err}`);
      }
    };

    void doTick();
    intervalRef.current = setInterval(doTick, 2000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running]);

  return (
    <div
      style={{
        marginTop: "2rem",
        padding: "1rem",
        backgroundColor: "#ffe0e0",
        borderRadius: "4px",
        border: "2px solid #ff4444",
      }}
    >
      <h2 style={{ margin: "0 0 0.5rem 0" }}>Server-Side Tick (PRZM repro)</h2>
      <p style={{ fontSize: "0.875rem", margin: "0 0 0.5rem 0" }}>
        Deploy 2 (new run): Simulates PRZM's driver-location flow: HTTP POST -
        {">"} server DO stub -{">"} setState -{">"} WebSocket broadcast to
        subscribers. Start in one tab, watch another tab receive ticks via
        subscription. Deploy while running to test disconnect.
      </p>
      <div className="counter-display">Tick (from subscription): {tick}</div>
      <div style={{ fontSize: "0.75rem", color: "#666", margin: "0.25rem 0" }}>
        Last fetch response: {lastResponse || "(not started)"}
      </div>
      <div className="button-group" style={{ marginTop: "0.5rem" }}>
        <button
          onClick={() => setRunning((r) => !r)}
          style={{
            backgroundColor: running ? "#dc3545" : "#28a745",
            color: "white",
          }}
        >
          {running ? "Stop" : "Start"} Server Ticks
        </button>
      </div>
    </div>
  );
}
