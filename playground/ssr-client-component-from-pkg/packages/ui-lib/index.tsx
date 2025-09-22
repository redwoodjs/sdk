"use client";

import React, { useState } from "react";

export const Button = ({ children }: { children: React.ReactNode }) => {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      {children} (Clicks: {count})
    </button>
  );
};
