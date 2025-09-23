"use client";

import React, { useState } from "react";

export const packageObject = {
  format: (name: string) => `Hello, ${name} from a package util!`,
};

export const PackageButton = () => {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      Package Button (Clicks: {count})
    </button>
  );
};
