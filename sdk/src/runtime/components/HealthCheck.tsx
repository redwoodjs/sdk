import React from "react";
import { RequestInfo } from "../requestInfo/types";
import { HealthCheckClient } from "./HealthCheckClient";

export const HealthCheckInfo: React.FC = async () => {
  const timestamp = Date.now();
  let status = "error";
  let verificationPassed = false;
  let result: any = null;

  try {
    result = await globalThis.__rw.callServer("__health", [timestamp]);

    // Check the result
    if (typeof result === "object" && result !== null) {
      status = result.status || "error";
      verificationPassed = result.timestamp === timestamp;
    } else if (result === "ok") {
      status = "ok";
      verificationPassed = true;
    }
  } catch (error) {
    console.error("Health check failed:", error);
    status = "error";
    result = { error: error instanceof Error ? error.message : String(error) };
  }

  return (
    <div
      id="health-check-container"
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
        Health Check: {status}
      </h2>
      <div
        id="health-check-result"
        data-result={status}
        data-timestamp={timestamp}
        data-verified={verificationPassed ? "true" : "false"}
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

      {/* Include the client component for on-demand health checks */}
      <HealthCheckClient />
    </div>
  );
};

/**
 * Wrapper component that displays health check info above the original page content
 */
export const HealthCheckWrapper: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  return (
    <>
      <HealthCheckInfo />
      {children}
    </>
  );
};

/**
 * Standalone health check page that conforms to the RouteComponent type
 */
export const HealthCheckPage = (
  requestInfo: RequestInfo
): React.JSX.Element => {
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "40px 20px" }}>
      <h1>RedwoodJS SDK Health Check</h1>
      <HealthCheckInfo />
      <p style={{ marginTop: "20px" }}>
        This is a dedicated health check page to verify that your RedwoodJS SDK
        application is functioning correctly. It tests that server-side
        rendering, client-side hydration, and RSC (React Server Components)
        actions are all working properly.
      </p>
      <p>
        Use the button below to manually trigger a new health check at any time.
      </p>
    </div>
  );
};
