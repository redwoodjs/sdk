import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NavigationPending, useNavigationPending } from "./clientSSR";

function NavigationSnapshotProbe() {
  const snapshot = useNavigationPending();

  return React.createElement(
    "span",
    null,
    snapshot.pending === null ? "not-pending" : "pending",
  );
}

describe("clientSSR entry", () => {
  it("exports a no-op NavigationPending boundary for SSR/workerd builds", () => {
    const html = renderToString(
      React.createElement(NavigationPending, null, "ready"),
    );

    expect(html).toContain("ready");
  });

  it("exports a non-pending navigation snapshot hook for SSR/workerd builds", () => {
    const html = renderToString(React.createElement(NavigationSnapshotProbe));

    expect(html).toContain("not-pending");
  });
});
