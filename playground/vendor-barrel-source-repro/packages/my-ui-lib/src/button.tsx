"use client";

import React from "react";

export function MyButton() {
  return (
    <button
      id="my-ui-lib-button"
      style={{ padding: "1rem", fontSize: "1.25rem" }}
      onClick={() => alert("clicked!")}
    >
      My UI Lib Button
    </button>
  );
}
