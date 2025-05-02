"use client"

import * as React from "react"

export function ClientCounter() {
  const [count, setCount] = React.useState(0)
  return <button onClick={() => setCount(c => c + 1)}>Client counter: {count}</button>
}
