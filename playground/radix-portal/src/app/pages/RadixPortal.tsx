"use client";

import * as Portal from "@radix-ui/react-portal";
import { useState } from "react";
import { myAction } from "../actions.js";
import { CounterButton } from "../components/CounterButton.js";

export function RadixPortal() {
  const [showPortal, setShowPortal] = useState(false);

  return (
    <form>
      <div>
        <h1>Radix Portal Test</h1>
        <button type="button" onClick={() => setShowPortal(true)}>
          Show Portal
        </button>
        {showPortal && (
          <Portal.Root>
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
              <h2>This is a Radix portal!</h2>
            </div>
          </Portal.Root>
        )}
        <CounterButton />
        <button onClick={myAction}>Trigger Action</button>
      </div>
    </form>
  );
}
