"use client";

import { useState } from "react";

export const CounterButton = () => {
  const [count, setCount] = useState(0);

  return <button onClick={() => setCount((c) => c + 1)}>Count: {count}</button>;
};
