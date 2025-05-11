import { join } from "path";
import * as fs from "fs/promises";
import { log } from "./constants.mjs";

/**
 * Creates the smoke test components in the target project directory
 */
export async function createSmokeTestComponents(
  targetDir: string,
  skipClient: boolean = false,
): Promise<void> {
  console.log("Creating smoke test components in project...");

  // Create directories if they don't exist
  const componentsDir = join(targetDir, "src", "app", "components");
  log("Creating components directory: %s", componentsDir);
  await fs.mkdir(componentsDir, { recursive: true });

  // Create __smokeTestFunctions.ts
  const smokeTestFunctionsPath = join(componentsDir, "__smokeTestFunctions.ts");
  log("Creating __smokeTestFunctions.ts at: %s", smokeTestFunctionsPath);
  const smokeTestFunctionsContent = `"use server";

export async function smokeTestAction(
  timestamp?: number,
): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { status: "ok", timestamp };
}
`;

  // Create SmokeTest.tsx with conditional client component import
  const smokeTestPath = join(componentsDir, "__SmokeTest.tsx");
  log("Creating __SmokeTest.tsx at: %s", smokeTestPath);
  const smokeTestContent = `
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
          : "{/* Include the client component for on-demand smoke tests */}\n      <SmokeTestClient />"
      }
    </div>
  );
};`;

  // Write the server files
  log("Writing SmokeTestFunctions file");
  await fs.writeFile(smokeTestFunctionsPath, smokeTestFunctionsContent);
  log("Writing SmokeTest component file");
  await fs.writeFile(smokeTestPath, smokeTestContent);

  // Only create client component if not skipping client-side tests
  if (!skipClient) {
    // Create SmokeTestClient.tsx
    const smokeTestClientPath = join(componentsDir, "__SmokeTestClient.tsx");
    log("Creating __SmokeTestClient.tsx at: %s", smokeTestClientPath);
    const smokeTestClientContent = `"use client";

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

      {lastCheck && (
        <div style={{ marginTop: "15px" }}>
          <div
            style={{
              padding: "10px",
              borderRadius: "4px",
              background: lastCheck.status === "ok" ? "#e6f7ee" : "#ffeded",
              border: \`1px solid \${
                lastCheck.status === "ok" ? "#0c9" : "#f44"
              }\`,
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
        style={{ display: "none" }}
      />
    </div>
  );
};`;

    log("Writing SmokeTestClient component file");
    await fs.writeFile(smokeTestClientPath, smokeTestClientContent);
    log("Created client-side smoke test component");
  } else {
    log("Skipping client-side smoke test component creation");
  }

  log("Smoke test components created successfully");
  console.log("Created smoke test components:");
  console.log(`- ${smokeTestFunctionsPath}`);
  console.log(`- ${smokeTestPath}`);
  if (!skipClient) {
    console.log(`- ${join(componentsDir, "__SmokeTestClient.tsx")}`);
  } else {
    console.log("- Client component skipped (--skip-client was specified)");
  }
}
