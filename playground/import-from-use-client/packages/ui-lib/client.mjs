"use client";

import React, { useState } from "react";

export const packageClientUtil = {
  format: (name) => `Hello from the package, ${name}!`,
};

export function PackageButton() {
  const [count, setCount] = useState(0);
  return React.createElement(
    "button",
    { onClick: () => setCount((c) => c + 1) },
    `Package Button clicks: ${count}`,
  );
}
