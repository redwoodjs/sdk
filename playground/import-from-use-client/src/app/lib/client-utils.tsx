"use client";

import React, { useState } from "react";

export const clientObject = {
  format: (name: string) => `Hello, ${name} from a client util!`,
};

export const ClientButton = () => {
  const [count, setCount] = useState(0);

  return (
    <button onClick={() => setCount(count + 1)}>
      App Button (Clicks: {count})
    </button>
  );
};
