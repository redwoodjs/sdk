"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CounterButton } from "../components/CounterButton";
import type { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <form>
      <h1>Form + Portal Bug</h1>
      <p>
        This page demonstrates the freeze when a portal is used inside a form.
      </p>
      <button type="button" onClick={() => setShowPortal(true)}>
        Show Portal (Will Freeze)
      </button>
      <CounterButton />
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
