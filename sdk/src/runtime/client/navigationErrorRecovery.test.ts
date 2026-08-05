import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initClientNavigation, navigate } from "./navigation";
import { resetNavigationStateForTests } from "./navigationState";

const assignMock = vi.fn();
const listeners = new Map<string, (...args: any[]) => any>();

const locationStub = {
  _href: "http://localhost/",
  get href() {
    return this._href;
  },
  set href(value: string) {
    this._href = value;
  },
  get pathname() {
    return new URL(this._href).pathname;
  },
  get search() {
    return new URL(this._href).search;
  },
  assign: assignMock,
};

vi.stubGlobal("window", {
  location: locationStub,
  addEventListener: (type: string, listener: (...args: any[]) => any) => {
    listeners.set(type, listener);
  },
  history: {
    scrollRestoration: "auto",
    pushState: vi.fn(),
    replaceState: vi.fn(),
    state: {},
  },
  scrollX: 0,
  scrollY: 0,
  scrollTo: vi.fn(),
});

vi.stubGlobal("document", {
  addEventListener: vi.fn(),
  visibilityState: "visible",
});

const callServerMock = vi.fn();

beforeEach(() => {
  listeners.clear();
  assignMock.mockClear();
  callServerMock.mockReset();
  (globalThis as any).__rsc_callServer = callServerMock;
  locationStub._href = "http://localhost/";
  resetNavigationStateForTests("http://localhost/");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("navigation error recovery", () => {
  it("recovers a failed navigate() with a hard navigation to the intended URL instead of rethrowing", async () => {
    initClientNavigation({});
    callServerMock.mockRejectedValue(new Error("boom"));

    await expect(navigate("/settings")).resolves.toBeUndefined();

    expect(assignMock).toHaveBeenCalledWith("http://localhost/settings");
    expect(console.error).toHaveBeenCalled();
  });

  it("prefers a configured onNavigationError handler over the hard navigation", async () => {
    const onNavigationError = vi.fn();
    initClientNavigation({ onNavigationError });
    const failure = new Error("boom");
    callServerMock.mockRejectedValue(failure);

    await navigate("/settings");

    expect(onNavigationError).toHaveBeenCalledWith({
      error: failure,
      href: "http://localhost/settings",
    });
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("repairs the optimistic path bookkeeping so a popstate retry of the failed target is not swallowed", async () => {
    // A custom handler that does not reload leaves the app in the diverged
    // state by choice; the framework's own bookkeeping must still allow a
    // back/forward retry of the failed route.
    initClientNavigation({ onNavigationError: () => {} });
    callServerMock.mockRejectedValueOnce(new Error("boom"));

    await navigate("/settings");
    expect(callServerMock).toHaveBeenCalledTimes(1);

    // Browser goes back/forward to the failed target.
    locationStub._href = "http://localhost/settings";
    callServerMock.mockResolvedValue(undefined);
    await listeners.get("popstate")?.();

    // Without the repair, the hash-only guard would have discarded this as a
    // same-path change and no retry fetch would happen.
    expect(callServerMock).toHaveBeenCalledTimes(2);
  });

  it("recovers a failed popstate navigation with a hard navigation to the current location", async () => {
    initClientNavigation({});
    callServerMock.mockRejectedValue(new Error("boom"));

    // The browser has already moved to the target when popstate fires.
    locationStub._href = "http://localhost/settings";
    await listeners.get("popstate")?.();

    expect(assignMock).toHaveBeenCalledWith("http://localhost/settings");
  });
});
