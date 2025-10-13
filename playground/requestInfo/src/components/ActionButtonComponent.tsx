"use client";

import { setHeadersAction } from "../app/actions";

export function ActionButtonComponent() {
  return (
    <div>
      <button type="button" onClick={() => setHeadersAction()}>
        Set Header via Server Action
      </button>
    </div>
  );
}
