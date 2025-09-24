"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function Broken() {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <form>
      <h1>Broken Example</h1>
      <p>This page will freeze when the portal is shown.</p>
      <button type="button" onClick={() => setShowPortal(true)}>
        Show Portal (Will Freeze)
      </button>
      <button type="button" onClick={() => alert("You should not see this.")}>
        Test Interactivity
      </button>
      {showPortal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              border: "1px solid red",
              padding: "20px",
              backgroundColor: "white",
            }}
          >
            <h2>This is a portal!</h2>
          </div>,
          document.body,
        )}
    </form>
  );
}
