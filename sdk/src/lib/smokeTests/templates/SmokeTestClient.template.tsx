export function getSmokeTestClientTemplate(): string {
  return `"use client";

import React, { useState } from "react";
import { smokeTestAction } from "./__smokeTestFunctions";

interface SmokeTestStatus {
  status: string;
  verificationPassed: boolean;
  timestamp: number;
  rawResult?: unknown;
  error?: string;
}

interface SmokeTestResponse {
  status: string;
  timestamp?: number;
  [key: string]: unknown;
}

export const SmokeTestClient: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [lastCheck, setLastCheck] = useState<SmokeTestStatus | null>(null);
  const [serverUpdateLoading, setServerUpdateLoading] = useState(false);
  const [serverUpdateResult, setServerUpdateResult] = useState<any>(null);

  const runSmokeTest = async () => {
    setLoading(true);
    const timestamp = Date.now();

    try {
      // Get current timestamp to verify round-trip
      const result = await smokeTestAction(timestamp);
      const status = result.status || "error";
      const verificationPassed = result.timestamp === timestamp;

      setLastCheck({
        status,
        verificationPassed,
        timestamp,
        rawResult: result,
      });
    } catch (error) {
      setLastCheck({
        status: "error",
        verificationPassed: false,
        timestamp,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  };

  const updateServerTimestamp = async () => {
    setServerUpdateLoading(true);
    const clientTimestamp = Date.now();

    try {
      // Call smokeTestAction with client timestamp to update server state
      const result = await smokeTestAction(clientTimestamp);
      setServerUpdateResult({
        success: true,
        timestamp: clientTimestamp,
        serverStoredTimestamp: result.serverStoredTimestamp,
        result,
      });
    } catch (error) {
      setServerUpdateResult({
        success: false,
        timestamp: clientTimestamp,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setServerUpdateLoading(false);
    }
  };

  return (
    <div
      className="smoke-test-client"
      style={{
        margin: "20px 0",
        padding: "15px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        background: "#f9f9f9",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h3>Manual Smoke Test</h3>
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <button
          data-testid="refresh-health"
          onClick={runSmokeTest}
          disabled={loading}
          style={{
            padding: "8px 16px",
            background: loading ? "#ccc" : "#0070f3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {loading ? "Checking..." : "Run Smoke Test"}
        </button>

        <button
          data-testid="update-server-timestamp"
          onClick={updateServerTimestamp}
          disabled={serverUpdateLoading}
          style={{
            padding: "8px 16px",
            background: serverUpdateLoading ? "#ccc" : "#22c55e",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: serverUpdateLoading ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {serverUpdateLoading ? "Updating..." : "Update Server Timestamp"}
        </button>
      </div>

      {serverUpdateResult && (
        <div style={{ marginBottom: "15px" }}>
          <div
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: serverUpdateResult.success ? "#e6f7ee" : "#ffeded",
              border: serverUpdateResult.success
                ? "1px solid #d1e7dd"
                : "1px solid #f5c2c7",
            }}
          >
            <h4 style={{ margin: "0 0 10px 0" }}>
              Server Timestamp Update:{" "}
              {serverUpdateResult.success ? "Success ✅" : "Failed ❌"}
            </h4>
            <p>Sent timestamp: {serverUpdateResult.timestamp}</p>
            {serverUpdateResult.success && (
              <p>
                Server stored: {serverUpdateResult.serverStoredTimestamp}
                {serverUpdateResult.serverStoredTimestamp ===
                serverUpdateResult.timestamp
                  ? " ✓"
                  : " ⚠️"}
              </p>
            )}
            {serverUpdateResult.error && (
              <p style={{ color: "#f44" }}>Error: {serverUpdateResult.error}</p>
            )}
          </div>
        </div>
      )}

      {lastCheck && (
        <div style={{ marginBottom: "15px" }}>
          <div
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: lastCheck.status === "ok" ? "#e6f7ee" : "#ffeded",
              border:
                lastCheck.status === "ok"
                  ? "1px solid #d1e7dd"
                  : "1px solid #f5c2c7",
            }}
          >
            <h4
              style={{
                margin: "0 0 10px 0",
                color: lastCheck.status === "ok" ? "#0c9" : "#f44",
              }}
            >
              Status: {lastCheck.status}
            </h4>
            <p>
              Timestamp verification:{" "}
              {lastCheck.verificationPassed ? "Passed ✅" : "Failed ⚠️"}
            </p>
            {lastCheck.error && (
              <p style={{ color: "#f44" }}>Error: {lastCheck.error}</p>
            )}
            <details style={{ marginTop: "10px" }}>
              <summary>Raw Result</summary>
              <pre
                style={{
                  background: "#f5f5f5",
                  padding: "10px",
                  borderRadius: "4px",
                  fontSize: "12px",
                  overflow: "auto",
                }}
              >
                {JSON.stringify(
                  {
                    timestamp: lastCheck.timestamp,
                    result: lastCheck.rawResult,
                    verificationPassed: lastCheck.verificationPassed,
                  },
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        </div>
      )}

      <div 
        id="smoke-test-client-timestamp"
        data-client-timestamp={lastCheck?.timestamp ?? ""}
        data-status={lastCheck?.status ?? ""}
        data-verified={lastCheck?.verificationPassed ? "true" : "false"}
        data-server-update-timestamp={serverUpdateResult?.timestamp ?? ""}
        style={{ display: "none" }}
      />
    </div>
  );
};`;
}
