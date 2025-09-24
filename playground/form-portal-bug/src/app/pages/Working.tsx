"use client";

import { useState } from "react";
import { createPortal } from "react-dom";

export function Working() {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <div>
      <h1>Working Example</h1>
      <p>This page should be interactive.</p>
      <button type="button" onClick={() => setShowPortal(true)}>
        Show Portal
      </button>
      <button type="button" onClick={() => alert("Page is interactive!")}>
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
              border: "1px solid green",
              padding: "20px",
              backgroundColor: "white",
            }}
          >
            <h2>This is a portal!</h2>
          </div>,
          document.body,
        )}
    </div>
  );
}
