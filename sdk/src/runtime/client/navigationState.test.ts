import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  abortPendingNavigation,
  beginPendingNavigation,
  commitPendingNavigation,
  configureNavigationTimeout,
  getNavigationSnapshot,
  resetNavigationStateForTests,
} from "./navigationState";

const assignMock = vi.fn();

vi.stubGlobal("window", {
  location: { href: "http://localhost/", assign: assignMock },
});

describe("navigation commit watchdog", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    assignMock.mockClear();
    resetNavigationStateForTests("http://localhost/");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("is disabled by default", () => {
    beginPendingNavigation("http://localhost/results?page=2");

    vi.advanceTimersByTime(60_000);

    expect(assignMock).not.toHaveBeenCalled();
    expect(getNavigationSnapshot().pending).not.toBeNull();
  });

  it("recovers with a hard navigation when a navigation never commits", () => {
    configureNavigationTimeout({ timeoutMs: 10_000 });
    beginPendingNavigation("http://localhost/results?page=2");

    vi.advanceTimersByTime(10_000);

    expect(assignMock).toHaveBeenCalledWith("http://localhost/results?page=2");
    expect(getNavigationSnapshot().pending).toBeNull();
  });

  it("does not fire when the navigation commits in time", () => {
    configureNavigationTimeout({ timeoutMs: 10_000 });
    const pending = beginPendingNavigation("http://localhost/results?page=2");
    commitPendingNavigation(pending.pendingUrl);

    vi.advanceTimersByTime(20_000);

    expect(assignMock).not.toHaveBeenCalled();
  });

  it("does not fire when the navigation is aborted in time", () => {
    configureNavigationTimeout({ timeoutMs: 10_000 });
    const pending = beginPendingNavigation("http://localhost/results?page=2");
    abortPendingNavigation(pending.id);

    vi.advanceTimersByTime(20_000);

    expect(assignMock).not.toHaveBeenCalled();
  });

  it("does not fire for a superseded navigation; the newer navigation gets the timeout", () => {
    configureNavigationTimeout({ timeoutMs: 10_000 });
    beginPendingNavigation("http://localhost/results?page=2");
    vi.advanceTimersByTime(5_000);
    beginPendingNavigation("http://localhost/results?page=3");

    vi.advanceTimersByTime(5_000);
    expect(assignMock).not.toHaveBeenCalled();

    vi.advanceTimersByTime(5_000);
    expect(assignMock).toHaveBeenCalledWith("http://localhost/results?page=3");
  });

  it("prefers a configured onTimeout handler over the hard navigation", () => {
    const onTimeout = vi.fn();
    configureNavigationTimeout({ timeoutMs: 2_000, onTimeout });

    beginPendingNavigation("http://localhost/results?page=2");
    vi.advanceTimersByTime(2_000);

    expect(onTimeout).toHaveBeenCalledWith({
      href: "http://localhost/results?page=2",
    });
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("does not fire for a handler configured without a timeout", () => {
    configureNavigationTimeout({ onTimeout: vi.fn() });

    beginPendingNavigation("http://localhost/results?page=2");
    vi.advanceTimersByTime(60_000);

    expect(assignMock).not.toHaveBeenCalled();
  });
});
