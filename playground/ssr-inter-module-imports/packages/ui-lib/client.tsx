"use client";

import { useState } from "react";

export const packageClientUtil = {
  format: (name: string) => `Hello from the package, ${name}!`,
};

export function PackageButton() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount((c) => c + 1)}>
      Package Button clicks: {count}
    </button>
  );
}
