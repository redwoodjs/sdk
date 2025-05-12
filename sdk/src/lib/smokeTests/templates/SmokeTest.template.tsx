export function getSmokeTestTemplate(skipClient: boolean = false): string {
  return `
import React from "react";
import { RequestInfo } from "rwsdk/worker";
${skipClient ? "" : 'import { SmokeTestClient } from "./__SmokeTestClient";'}
import { smokeTestAction } from "./__smokeTestFunctions";

export const SmokeTestInfo: React.FC = async () => {
  const timestamp = Date.now();
  let status = "error";
  let verificationPassed = false;
  let result: any = null;

  try {
    result = await smokeTestAction(timestamp);
    status = result.status || "error";
    verificationPassed = result.timestamp === timestamp;
  } catch (error) {
    console.error("Smoke test failed:", error);
    status = "error";
    result = { error: error instanceof Error ? error.message : String(error) };
  }

  return (
    <div
      id="smoke-test-container"
      data-testid="health-status"
      data-status={status}
      data-timestamp={timestamp}
      data-server-timestamp={Date.now()}
      data-verified={verificationPassed ? "true" : "false"}
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
        {verificationPassed
          ? "Timestamp verification passed ✅"
          : "Timestamp verification failed ⚠️"}
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
          {JSON.stringify({ timestamp, result, verificationPassed }, null, 2)}
        </pre>
      </details>

      ${
        skipClient
          ? "<!-- Client-side checks disabled -->"
          : "{/* Include the client component for on-demand smoke tests */}\\n      <SmokeTestClient />"
      }
    </div>
  );
};`;
}
