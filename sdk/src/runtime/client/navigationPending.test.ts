import React, { Suspense } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";

import {
  NavigationPayloadProvider,
  NavigationPending,
  shouldSuspendForPendingNavigation,
} from "./navigationPending";
import {
  abortPendingNavigation,
  beginPendingNavigation,
  commitPendingNavigation,
  getNavigationSnapshot,
  isSameNavigationDocumentUrl,
  resetNavigationStateForTests,
} from "./navigationState";

function renderPendingBoundary(meta: {
  source: "initial" | "navigation";
  href: string;
}) {
  return renderToString(
    React.createElement(
      NavigationPayloadProvider,
      { meta },
      React.createElement(
        Suspense,
        { fallback: React.createElement("span", null, "loading") },
        React.createElement(
          NavigationPending,
          null,
          React.createElement("span", null, "ready"),
        ),
      ),
    ),
  );
}

async function expectPromiseResolved(promise: Promise<void>) {
  let resolved = false;
  promise.then(() => {
    resolved = true;
  });

  await Promise.resolve();

  expect(resolved).toBe(true);
}

describe("navigation pending state", () => {
  beforeEach(() => {
    resetNavigationStateForTests("http://localhost/results?search=old&page=1");
  });

  it("tracks a pending navigation until the matching navigation commit", async () => {
    const pending = beginPendingNavigation(
      "http://localhost/results?search=new&page=1",
    );

    expect(getNavigationSnapshot().pending?.id).toBe(pending.id);
    expect(getNavigationSnapshot().pending?.currentUrl.href).toBe(
      "http://localhost/results?search=old&page=1",
    );
    expect(getNavigationSnapshot().pending?.pendingUrl.href).toBe(
      "http://localhost/results?search=new&page=1",
    );

    expect(
      commitPendingNavigation("http://localhost/results?search=old&page=1"),
    ).toBe(false);
    expect(getNavigationSnapshot().pending?.id).toBe(pending.id);

    expect(
      commitPendingNavigation("http://localhost/results?search=new&page=1"),
    ).toBe(true);
    expect(getNavigationSnapshot().pending).toBeNull();
    expect(getNavigationSnapshot().currentUrl.href).toBe(
      "http://localhost/results?search=new&page=1",
    );
    await expectPromiseResolved(pending.promise);
  });

  it("resolves a superseded navigation promise while keeping the newest navigation pending", async () => {
    const first = beginPendingNavigation("/results?search=first&page=1");
    const second = beginPendingNavigation("/results?search=second&page=1");

    expect(getNavigationSnapshot().pending?.id).toBe(second.id);
    await expectPromiseResolved(first.promise);
    expect(getNavigationSnapshot().pending?.id).toBe(second.id);
  });

  it("treats hash-only differences as the same navigation document", async () => {
    const pending = beginPendingNavigation("/results?search=new&page=1");

    expect(
      isSameNavigationDocumentUrl(
        "http://localhost/results?search=new&page=1",
        "http://localhost/results?search=new&page=1#details",
      ),
    ).toBe(true);
    expect(
      isSameNavigationDocumentUrl(
        "http://localhost/results?search=new&page=1",
        "http://localhost/results?search=new&page=2#details",
      ),
    ).toBe(false);

    expect(commitPendingNavigation("/results?search=new&page=1#details")).toBe(
      true,
    );
    expect(getNavigationSnapshot().pending).toBeNull();
    await expectPromiseResolved(pending.promise);
  });

  it("can abort only the matching pending navigation", async () => {
    const pending = beginPendingNavigation("/results?search=new&page=1");

    expect(abortPendingNavigation(pending.id + 1)).toBe(false);
    expect(getNavigationSnapshot().pending?.id).toBe(pending.id);

    expect(abortPendingNavigation(pending.id)).toBe(true);
    expect(getNavigationSnapshot().pending).toBeNull();
    await expectPromiseResolved(pending.promise);
  });
});

describe("shouldSuspendForPendingNavigation", () => {
  beforeEach(() => {
    resetNavigationStateForTests("http://localhost/results?search=old&page=1");
  });

  it("suspends for any pending navigation by default", () => {
    beginPendingNavigation("/results?search=new&page=1");

    expect(shouldSuspendForPendingNavigation(getNavigationSnapshot())).toBe(
      true,
    );
  });

  it("can watch a shorthand list of search params", () => {
    beginPendingNavigation("/results?search=new&page=1&sort=asc");

    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        searchParams: ["search"],
      }),
    ).toBe(true);
    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        searchParams: ["page"],
      }),
    ).toBe(false);
  });

  it("does not let the searchParams shorthand suspend for pathname-only changes", () => {
    beginPendingNavigation("/other?search=old&page=1");

    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        searchParams: ["search", "page"],
      }),
    ).toBe(false);
  });

  it("supports explicit watch configuration", () => {
    beginPendingNavigation("/other?search=old&page=2#details");

    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        watch: { pathname: false, searchParams: ["page"], hash: false },
      }),
    ).toBe(true);
    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        watch: { pathname: false, searchParams: ["search"], hash: false },
      }),
    ).toBe(false);
    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        watch: { pathname: false, searchParams: false, hash: true },
      }),
    ).toBe(true);
  });

  it("supports a custom predicate", () => {
    beginPendingNavigation("/results?tab=details&page=1");

    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        when: ({ currentUrl, pendingUrl }) =>
          currentUrl.searchParams.get("tab") !==
          pendingUrl.searchParams.get("tab"),
      }),
    ).toBe(true);
    expect(
      shouldSuspendForPendingNavigation(getNavigationSnapshot(), {
        when: ({ currentUrl, pendingUrl }) =>
          currentUrl.searchParams.get("page") !==
          pendingUrl.searchParams.get("page"),
      }),
    ).toBe(false);
  });

  it("keeps current payloads suspended but lets the matching navigation payload render", () => {
    beginPendingNavigation("/results?search=new&page=1");

    expect(
      renderPendingBoundary({
        source: "initial",
        href: "http://localhost/results?search=old&page=1",
      }),
    ).toContain("loading");
    expect(
      renderPendingBoundary({
        source: "navigation",
        href: "http://localhost/results?search=other&page=1",
      }),
    ).toContain("loading");
    expect(
      renderPendingBoundary({
        source: "navigation",
        href: "http://localhost/results?search=new&page=1",
      }),
    ).toContain("ready");
    expect(
      renderPendingBoundary({
        source: "navigation",
        href: "http://localhost/results?search=new&page=1#details",
      }),
    ).toContain("ready");
  });
});
