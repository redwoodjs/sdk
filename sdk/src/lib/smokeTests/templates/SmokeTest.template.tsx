export function getSmokeTestTemplate(skipClient: boolean = false): string {
  return `
import React from "react";
import { RequestInfo } from "rwsdk/worker";
${skipClient ? "" : 'import { SmokeTestClient } from "./__SmokeTestClient";'}
import serverStyles from "./smokeTestServerStyles.module.css";
import "./smokeTestServerStyles.css";
import { getSmokeTestTimestamp } from "./__smokeTestFunctions";

export const SmokeTestInfo: React.FC = async () => {
  const currentTime = Date.now();
  let status = "error";
  let timestamp = 0;

  try {
    const result = await getSmokeTestTimestamp();
    status = result.status || "error";
    timestamp = result.timestamp;
  } catch (error) {
    console.error("Smoke test failed:", error);
    status = "error";
  }

  return (
    <div
      id="smoke-test-container"
      data-testid="health-status"
      data-status={status}
      data-timestamp={timestamp}
      data-server-timestamp={currentTime}
      style={{
        fontFamily: "system-ui, -apple-system, sans-serif",
        margin: "20px",
        padding: "15px",
        border: "1px solid #ddd",
        borderRadius: "4px",
        background: "#f9f9f9",
      }}
    >
      <h2
        style={{
          color: status === "ok" ? "#0c9" : "#f44",
          margin: "0 0 10px 0",
        }}
      >
        Smoke Test: {status}
      </h2>
      <div
        id="smoke-test-result"
      >
        Server Timestamp: {timestamp}
      </div>

      {/* Server Stylesheet Marker */}
      <div
        className="smoke-test-server-url-styles"
        data-testid="smoke-test-server-url-styles"
      >
        <p>A green box should appear above this text (from URL import)</p>
      </div>
      <div
        className={serverStyles.smokeTestServerStyles}
        data-testid="smoke-test-server-styles"
      >
        <p>A purple box should appear above this text (from CSS module)</p>
      </div>
      
      {/* HMR Testing Marker - Do not modify this comment */}
      <div 
        id="server-hmr-marker"
        data-testid="server-hmr-marker"
        data-hmr-text="original"
        data-hmr-timestamp={Date.now()}
      >
        Server Component HMR: <span>Original Text</span>
      </div>
      
      <details style={{ marginTop: "10px" }}>
        <summary>Details</summary>
        <pre
          style={{
            background: "#f5f5f5",
            padding: "10px",
            borderRadius: "4px",
            fontSize: "12px",
            overflow: "auto",
          }}
        >
          {JSON.stringify({ currentTime, serverTimestamp: timestamp, status }, null, 2)}
        </pre>
      </details>

      ${!skipClient ? "<SmokeTestClient/>" : ""}
    </div>
  );
};`;
}
