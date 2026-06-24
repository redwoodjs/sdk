"use client";

import sample from "../data/sample.json";

export function JsonBadge() {
  return (
    <p id="client-json-message">
      client says: <strong>{sample.greeting}</strong>
    </p>
  );
}
