"use client";

import { useState } from "react";
import defaultAction, { getGreeting, getGreetingPost, updateName } from "../actions";

export function ServerFunctionsDemo() {
  const [result, setResult] = useState<string>("");

  return (
    <div style={{ padding: "20px", border: "1px solid #ccc", marginTop: "20px" }}>
      <h2>Server Functions Demo</h2>
      <div style={{ display: "flex", gap: "10px", marginBottom: "10px" }}>
        <button id="run-get-greeting" onClick={async () => setResult(await getGreeting("World"))}>
          Run getGreeting (GET)
        </button>
        <button id="run-get-greeting-post" onClick={async () => setResult(await getGreetingPost("World"))}>
          Run getGreetingPost (POST)
        </button>
        <button id="run-update-name" onClick={async () => {
          const res = await updateName("New Name");
          setResult(JSON.stringify(res));
        }}>
          Run updateName (Action)
        </button>
        <button id="run-default-action" onClick={async () => setResult(await defaultAction())}>
          Run Default Action
        </button>
      </div>
      <div>
        <strong>Result:</strong> <span id="server-function-result">{result}</span>
      </div>
    </div>
  );
}
