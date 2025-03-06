"use client";
import { useEffect, useState } from "react";

export function Test() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    console.log("count", count);
  }, [count]);

  return (
    <div>
      <button onClick={() => setCount(count + 1)}>Click me</button>
      <p>Count: {count}</p>
    </div>
  );
}
