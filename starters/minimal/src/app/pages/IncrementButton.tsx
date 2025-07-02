"use client";

import { increment } from "./functions";

export function IncrementButton() {
  return (
    <button
      onClick={async () => {
        await increment();
        console.log("2");
      }}
    >
      Increment
    </button>
  );
}
