"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
//import { myAction } from "../actions.js";
import { CounterButton } from "../components/CounterButton.js";

export function DirectReactPortal() {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <form>
      <div>
        <h1>Direct React Portal Test</h1>
        <button type="button" onClick={() => setShowPortal(true)}>
          Show Portal
        </button>
        {showPortal &&
          createPortal(
            <div
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                border: "1px solid blue",
                padding: "20px",
                backgroundColor: "white",
              }}
            >
              <h2>This is a direct React portal!</h2>
            </div>,
            document.body,
          )}
        <CounterButton />
      </div>
    </form>
  );
}
