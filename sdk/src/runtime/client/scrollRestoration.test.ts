import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createScrollRestoration,
  HISTORY_STATE_SCROLL_KEY,
  type NavigationHistoryState,
} from "./scrollRestoration";

describe("scrollRestoration", () => {
  let historyState: NavigationHistoryState;

  beforeEach(() => {
    historyState = {};

    vi.stubGlobal("window", {
      location: { href: "http://localhost/" },
      scrollX: 0,
      scrollY: 0,
      scrollTo: vi.fn(),
      history: {
        scrollRestoration: "auto",
        get state() {
          return historyState;
        },
        pushState: vi.fn((state: NavigationHistoryState) => {
          historyState = state;
        }),
        replaceState: vi.fn((state: NavigationHistoryState) => {
          historyState = state;
        }),
      },
    });
  });

  it("restores scroll from history state after a reload", () => {
    historyState = {
      [HISTORY_STATE_SCROLL_KEY]: "entry:1",
      scrollX: 12,
      scrollY: 345,
    };

    const scrollRestoration = createScrollRestoration();
    scrollRestoration.initialize();
    scrollRestoration.applyPendingScroll();

    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 12,
      top: 345,
      behavior: "instant",
    });
  });

  it("migrates legacy scrollX/scrollY history state on boot", () => {
    historyState = { scrollX: 7, scrollY: 222 };

    const scrollRestoration = createScrollRestoration();
    scrollRestoration.initialize();
    scrollRestoration.applyPendingScroll();

    expect(window.history.replaceState).toHaveBeenCalledWith(
      expect.objectContaining({
        [HISTORY_STATE_SCROLL_KEY]: expect.any(String),
        scrollX: 7,
        scrollY: 222,
      }),
      "",
      "http://localhost/",
    );
    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 7,
      top: 222,
      behavior: "instant",
    });
  });

  it("restores back/forward positions from the in-memory key map", () => {
    const scrollRestoration = createScrollRestoration();
    scrollRestoration.initialize();
    const firstEntryState = historyState;

    window.scrollY = 500;
    scrollRestoration.recordCurrentPosition(0, 500);
    scrollRestoration.pushEntry(
      "/next",
      new URL("/next", "http://localhost/"),
      { x: 0, y: 0 },
    );

    historyState = firstEntryState;
    scrollRestoration.restorePopStateScroll();
    scrollRestoration.applyPendingScroll();

    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 0,
      top: 500,
      behavior: "instant",
    });
  });

  it("does not write to history state while recording scroll", () => {
    const scrollRestoration = createScrollRestoration();
    scrollRestoration.initialize();
    vi.mocked(window.history.replaceState).mockClear();

    scrollRestoration.recordCurrentPosition(0, 100);
    scrollRestoration.recordCurrentPosition(0, 200);

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("flushes the latest scroll position to history state on lifecycle boundaries", () => {
    const scrollRestoration = createScrollRestoration();
    scrollRestoration.initialize();
    vi.mocked(window.history.replaceState).mockClear();

    scrollRestoration.recordCurrentPosition(4, 400);
    scrollRestoration.flushCurrentPositionToHistoryState(4, 400);

    expect(window.history.replaceState).toHaveBeenCalledWith(
      expect.objectContaining({
        [HISTORY_STATE_SCROLL_KEY]: expect.any(String),
        scrollX: 4,
        scrollY: 400,
      }),
      "",
      "http://localhost/",
    );
  });
});
