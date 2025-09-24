"use client";

import * as Portal from "@radix-ui/react-portal";

export const PortalComponent = () => {
  return (
    <div style={{ border: "1px solid black", padding: "10px" }}>
      <h1>My App Content</h1>
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
          <h2>This is a portal!</h2>
        </div>
      </Portal.Root>
    </div>
  );
};
