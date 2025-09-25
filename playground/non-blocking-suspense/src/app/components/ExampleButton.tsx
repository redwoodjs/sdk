"use client";

import { useState } from "react";

export function ExampleButton({ message }: { message: string }) {
  const [count, setCount] = useState(0);

  return (
    <button
      onClick={() => {
        alert(message);
        setCount(count + 1);
      }}
    >
      Clicks: {count}
    </button>
  );
}
