"use client";
import { increment } from "../counter";

export function Like() {
  return <button onClick={() => increment()}>+</button>;
}
