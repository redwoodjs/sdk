"use client";

import { useState } from "react";
import defaultAction, {
  getGreeting,
  getGreetingWithInterruptors,
  getGreetingWithRedirect,
  getGreetingWithErrorResponse,
  getGreetingWithPost,
  updateName,
  updateNameWithInterruptors,
  updateNameWithRedirect,
  updateNameWithErrorResponse,
} from "../actions";

export function ServerFunctionsDemo() {
  const [result, setResult] = useState<string>("");

  const run = async (fn: () => Promise<any>) => {
    try {
      setResult("Running...");
      const res = await fn();
      console.log("[demo] Result:", res);
      setResult(JSON.stringify(res));
    } catch (e: any) {
      console.error("[demo] Error caught:", e);
      let message = "Unknown Error";
      if (e instanceof Error) {
        message = e.message;
      } else if (typeof e === "string") {
        message = e;
      } else {
        try {
          message = JSON.stringify(e);
        } catch {
          message = String(e);
        }
      }
      setResult(`Caught Error: ${message}`);

      // Adding this so we can test the global error handling
      if (
        message.includes("Server function returned status 400") ||
        message.includes("Server function returned status 500")
      ) {
        throw e;
      }
    }
  };

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", marginTop: "20px" }}>
      <h2>Server Functions Demo</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
        <section>
          <h3>Queries</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button id="query-greeting" onClick={() => run(() => getGreeting("World"))}>
              getGreeting (GET)
            </button>
            <button id="query-greeting-interruptors" onClick={() => run(() => getGreetingWithInterruptors("World"))}>
              getGreeting (Interruptors)
            </button>
            <button id="query-greeting-redirect" onClick={() => run(() => getGreetingWithRedirect())}>
              getGreeting (Redirect)
            </button>
            <button id="query-greeting-error" onClick={() => run(() => getGreetingWithErrorResponse())}>
              getGreeting (Error Response)
            </button>
            <button id="query-greeting-post" onClick={() => run(() => getGreetingWithPost("World"))}>
              getGreeting (POST)
            </button>
          </div>
        </section>

        <section>
          <h3>Actions</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button id="action-update-name" onClick={() => run(() => updateName("Agent"))}>
              updateName
            </button>
            <button id="action-update-name-interruptors" onClick={() => run(() => updateNameWithInterruptors("Agent"))}>
              updateName (Interruptors)
            </button>
            <button id="action-update-name-redirect" onClick={() => run(() => updateNameWithRedirect())}>
              updateName (Redirect)
            </button>
            <button id="action-update-name-error" onClick={() => run(() => updateNameWithErrorResponse())}>
              updateName (Error Response)
            </button>
            <button id="action-default" onClick={() => run(() => defaultAction())}>
              Default Action
            </button>
          </div>
        </section>
      </div>

      <div style={{ marginTop: "20px", padding: "10px", backgroundColor: "#f9f9f9" }}>
        <strong>Result:</strong> <span id="server-function-result">{result}</span>
      </div>
    </div>
  );
}
