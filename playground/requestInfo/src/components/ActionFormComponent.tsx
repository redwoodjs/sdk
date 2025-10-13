"use client";

import { setHeadersAction } from "../app/actions";

export function ActionFormComponent() {
  return (
    <form action={setHeadersAction}>
      <button type="submit">Set Header via Server Action</button>
    </form>
  );
}
