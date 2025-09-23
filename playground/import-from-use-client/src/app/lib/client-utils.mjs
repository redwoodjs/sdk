"use client";

import React, { useState } from "react";

export const appClientUtil = {
  format: (name) => `Hello from the app, ${name}!`,
};

export function AppButton() {
  const [count, setCount] = useState(0);
  return React.createElement(
    "button",
    { onClick: () => setCount((c) => c + 1) },
    `App Button clicks: ${count}`,
  );
}
