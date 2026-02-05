"use client";

import { useState } from "react";
import {
  getGreeting,
  getGreetingPost,
  updateName,
  getRedirectQuery,
  getErrorQuery,
  getRedirectAction,
  getErrorAction,
} from "../actions";

export function ServerFunctionsDemo() {
  const [result, setResult] = useState<string>("");

  return (
    <div
      style={{ padding: "20px", border: "1px solid #ccc", marginTop: "20px" }}
    >
      <h2>Server Functions Demo</h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "20px",
          marginBottom: "20px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3>Server Queries</h3>
          <button
            id="run-get-greeting"
            onClick={async () => setResult(await getGreeting("World"))}
          >
            Run getGreeting (GET)
          </button>
          <button
            id="run-get-greeting-post"
            onClick={async () => setResult(await getGreetingPost("World"))}
          >
            Run getGreetingPost (POST)
          </button>
          <button
            id="run-get-redirect-query"
            onClick={async () => {
              try {
                await getRedirectQuery();
              } catch (e: any) {
                setResult(
                  `Redirected (check network tab) or Error: ${e.message}`,
                );
              }
            }}
          >
            Run getRedirectQuery
          </button>
          <button
            id="run-get-error-query"
            onClick={async () => {
              try {
                await getErrorQuery();
              } catch (e: any) {
                setResult(`Error: ${e.message || "Unknown error"}`);
              }
            }}
          >
            Run getErrorQuery
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h3>Server Actions</h3>
          <button
            id="run-update-name"
            onClick={async () => {
              const res = await updateName("New Name");
              setResult(JSON.stringify(res));
            }}
          >
            Run updateName (Action)
          </button>
          <button
            id="run-get-redirect-action"
            onClick={async () => {
              try {
                await getRedirectAction();
              } catch (e: any) {
                setResult(
                  `Redirected (check network tab) or Error: ${e.message}`,
                );
              }
            }}
          >
            Run getRedirectAction
          </button>
          <button
            id="run-get-error-action"
            onClick={async () => {
              try {
                await getErrorAction();
              } catch (e: any) {
                setResult(`Error: ${e.message || "Unknown error"}`);
              }
            }}
          >
            Run getErrorAction
          </button>
        </div>
      </div>
      <div>
        <strong>Result:</strong> <span id="server-function-result">{result}</span>
      </div>
    </div>
  );
}
