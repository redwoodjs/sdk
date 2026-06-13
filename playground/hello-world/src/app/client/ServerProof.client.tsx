"use client";

import { useState } from "react";
import { getProofGreeting, updateProofName } from "../serverProof";

export function ServerProofClient() {
  const [result, setResult] = useState("idle");

  return (
    <div data-proof="server-proof-client">
      <button id="server-query-proof" onClick={async () => setResult(await getProofGreeting("Adapter"))}>
        Run serverQuery proof
      </button>
      <button id="server-action-proof" onClick={async () => setResult(await updateProofName("Adapter"))}>
        Run serverAction proof
      </button>
      <output id="server-proof-result">{result}</output>
    </div>
  );
}
