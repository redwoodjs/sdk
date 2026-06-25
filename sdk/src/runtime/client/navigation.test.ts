import { beforeEach, describe, expect, it, vi } from "vitest";
import { initClientNavigation, validateClickEvent } from "./navigation";
import {
  getNavigationSnapshot,
  resetNavigationStateForTests,
} from "./navigationState";
import { HISTORY_STATE_SCROLL_KEY } from "./scrollRestoration";

beforeEach(() => {
  resetNavigationStateForTests();
});

// Mocking browser globals
vi.stubGlobal("window", {
  location: { href: "http://localhost/" },
  addEventListener: vi.fn(),
  history: {
    scrollRestoration: "auto",
    pushState: vi.fn(),
    replaceState: vi.fn(),
    state: {},
  },
  scrollX: 0,
  scrollY: 0,
});

vi.stubGlobal("document", {
  addEventListener: vi.fn(),
});

vi.stubGlobal("history", {
  scrollRestoration: "auto",
});

vi.stubGlobal(
  "Headers",
  class {
    map: Record<string, string> = {};
    constructor(init?: any) {
      if (init && init.Location) {
        this.map.location = init.Location;
      }
    }
    get(name: string) {
      return this.map[name.toLowerCase()] || null;
    }
  },
);

describe("clientNavigation", () => {
  let mockEvent: MouseEvent = {
    button: 0,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ctrlKey: false,
  } as unknown as MouseEvent;
  let mockTarget = {
    closest: () => {
      return {
        getAttribute: () => "/test",
        hasAttribute: () => false,
      };
    },
  } as unknown as HTMLElement;

  it("should return true", () => {
    expect(validateClickEvent(mockEvent, mockTarget)).toBe(true);
  });

  it("should return false if the event is not a left click", () => {
    expect(validateClickEvent({ ...mockEvent, button: 1 }, mockTarget)).toBe(
      false,
    );
  });

  it("none of the modifier keys are pressed", () => {
    expect(
      validateClickEvent({ ...mockEvent, metaKey: true }, mockTarget),
    ).toBe(false);
  });

  it("the target is not an anchor tag", () => {
    expect(
      validateClickEvent(mockEvent, {
        closest: () => undefined,
      } as unknown as HTMLElement),
    ).toBe(false);
  });

  it("should have an href attribute", () => {
    expect(
      validateClickEvent(mockEvent, {
        closest: () => ({ getAttribute: () => undefined }),
      } as unknown as HTMLElement),
    ).toBe(false);
  });

  it("should not include an #hash", () => {
    expect(
      validateClickEvent(mockEvent, {
        closest: () => ({
          getAttribute: () => "/test#hash",
          hasAttribute: () => false,
        }),
      } as unknown as HTMLElement),
    ).toBe(false);
  });

  it("should be a relative link", () => {
    expect(
      validateClickEvent(mockEvent, {
        closest: () => ({
          getAttribute: () => "/test",
          hasAttribute: () => false,
        }),
      } as unknown as HTMLElement),
    ).toBe(true);
  });
});

// Regression tests for issue #1123: onNavigate callback was never called
// Root cause: commit c543ef7 extracted navigate() but dropped onNavigate wiring
describe("onNavigate callback (issue #1123 regression)", () => {
  let capturedClickHandler: ((event: MouseEvent) => void) | null = null;
  let capturedPopstateHandler: (() => void) | null = null;

  beforeEach(() => {
    capturedClickHandler = null;
    capturedPopstateHandler = null;
    vi.clearAllMocks();

    let historyState: Record<string, unknown> = {};

    // Capture registered event listeners so we can invoke them manually
    vi.stubGlobal("document", {
      visibilityState: "visible",
      querySelectorAll: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === "click") capturedClickHandler = handler;
      }),
    });
    vi.stubGlobal("window", {
      location: { href: "http://localhost/", pathname: "/", search: "" },
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === "popstate") capturedPopstateHandler = handler;
      }),
      history: {
        scrollRestoration: "auto",
        get state() {
          return historyState;
        },
        pushState: vi.fn((state: Record<string, unknown>) => {
          historyState = state;
        }),
        replaceState: vi.fn((state: Record<string, unknown>) => {
          historyState = state;
        }),
      },
      scrollX: 0,
      scrollY: 0,
      scrollTo: vi.fn(),
    });
    vi.stubGlobal("history", {
      scrollRestoration: "auto",
      pushState: vi.fn(),
      replaceState: vi.fn(),
      state: {},
    });
    // Assign directly to globalThis without replacing it (avoids breaking Vitest internals)
    (globalThis as any).__rsc_callServer = vi.fn().mockResolvedValue(undefined);
  });

  it("onNavigate is called during link click navigation", async () => {
    const onNavigate = vi.fn();

    initClientNavigation({ onNavigate });

    expect(capturedClickHandler).not.toBeNull();

    const fakeAnchor = {
      getAttribute: (attr: string) => (attr === "href" ? "/about" : null),
      hasAttribute: () => false,
      target: "",
      closest: (sel: string) => (sel === "a" ? fakeAnchor : null),
    };
    const fakeTarget = {
      closest: (sel: string) => (sel === "a" ? fakeAnchor : null),
    };
    const fakeClickEvent = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      target: fakeTarget,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;

    await capturedClickHandler!(fakeClickEvent);

    expect(onNavigate).toHaveBeenCalled();
  });

  it("onNavigate is called during popstate navigation", async () => {
    const onNavigate = vi.fn();

    initClientNavigation({ onNavigate });

    expect(capturedPopstateHandler).not.toBeNull();

    (window.location as unknown as { pathname: string }).pathname = "/about";
    await capturedPopstateHandler!();

    expect(onNavigate).toHaveBeenCalled();
  });

  it("onNavigate fires after pushState but before RSC fetch", async () => {
    const callOrder: string[] = [];
    const onNavigate = vi.fn(() => {
      callOrder.push("onNavigate");
    });
    (globalThis as any).__rsc_callServer = vi.fn(() => {
      callOrder.push("rscCallServer");
      return Promise.resolve();
    });

    initClientNavigation({ onNavigate });

    const fakeAnchor = {
      getAttribute: (attr: string) => (attr === "href" ? "/about" : null),
      hasAttribute: () => false,
      target: "",
      closest: (sel: string) => (sel === "a" ? fakeAnchor : null),
    };
    const fakeTarget = {
      closest: (sel: string) => (sel === "a" ? fakeAnchor : null),
    };
    const fakeClickEvent = {
      button: 0,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      target: fakeTarget,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;

    await capturedClickHandler!(fakeClickEvent);

    expect(callOrder).toEqual(["onNavigate", "rscCallServer"]);
    expect(window.history.pushState).toHaveBeenCalled();
  });
});

describe("initClientNavigation", () => {
  let historyState: Record<string, unknown>;
  let capturedScrollHandler: (() => void) | null = null;
  let capturedPagehideHandler: (() => void) | null = null;
  let capturedVisibilityChangeHandler: (() => void) | null = null;
  let capturedPopstateHandler: (() => Promise<void>) | null = null;

  beforeEach(() => {
    historyState = {};
    capturedScrollHandler = null;
    capturedPagehideHandler = null;
    capturedVisibilityChangeHandler = null;
    capturedPopstateHandler = null;
    vi.clearAllMocks();

    const mockHistory = {
      scrollRestoration: "auto",
      get state() {
        return historyState;
      },
      pushState: vi.fn((state: Record<string, unknown>) => {
        historyState = state;
      }),
      replaceState: vi.fn((state: Record<string, unknown>) => {
        historyState = state;
      }),
    };

    vi.stubGlobal("document", {
      visibilityState: "visible",
      querySelectorAll: vi.fn().mockReturnValue([]),
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "visibilitychange") {
          capturedVisibilityChangeHandler = handler;
        }
      }),
    });

    vi.stubGlobal("window", {
      location: { href: "http://localhost/", pathname: "/", search: "" },
      addEventListener: vi.fn((event: string, handler: () => void) => {
        if (event === "scroll") {
          capturedScrollHandler = handler;
        }
        if (event === "pagehide") {
          capturedPagehideHandler = handler;
        }
        if (event === "popstate") {
          capturedPopstateHandler = handler as () => Promise<void>;
        }
      }),
      history: mockHistory,
      fetch: vi.fn(),
      scrollX: 0,
      scrollY: 0,
      scrollTo: vi.fn(),
    });
    vi.stubGlobal("history", mockHistory);
  });

  it("handleResponse should follow redirects", () => {
    const { handleResponse } = initClientNavigation();

    const mockResponse = {
      status: 302,
      headers: new Headers({ Location: "/new-page" }),
      ok: false,
    } as unknown as Response;

    const result = handleResponse(mockResponse);

    expect(result).toBe(false);
    expect(window.location.href).toBe("/new-page");
  });

  it("handleResponse should reload on error", () => {
    const { handleResponse } = initClientNavigation();

    const mockResponse = {
      status: 500,
      ok: false,
    } as unknown as Response;

    const result = handleResponse(mockResponse);

    expect(result).toBe(false);
    expect(window.location.href).toBe("http://localhost/");
  });

  it("sets history.scrollRestoration to manual so the browser does not restore scroll before the RSC payload commits", () => {
    history.scrollRestoration = "auto";
    initClientNavigation();
    expect(history.scrollRestoration).toBe("manual");
  });

  it("ignores hash-only popstate events so anchor links keep their native scroll", async () => {
    const onNavigate = vi.fn();
    (globalThis as any).__rsc_callServer = vi.fn().mockResolvedValue(undefined);

    const { onHydrated } = initClientNavigation({ onNavigate });
    expect(capturedPopstateHandler).not.toBeNull();

    (window.location as unknown as { hash: string; href: string }).hash =
      "#heading";
    (window.location as unknown as { hash: string; href: string }).href =
      "http://localhost/#heading";
    window.scrollY = 500;

    await capturedPopstateHandler!();
    onHydrated();

    expect(onNavigate).not.toHaveBeenCalled();
    expect((globalThis as any).__rsc_callServer).not.toHaveBeenCalled();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });

  it("keeps navigation pending until the matching navigation payload hydrates", async () => {
    (globalThis as any).__rsc_callServer = vi.fn().mockResolvedValue(undefined);

    const { onHydrated } = initClientNavigation();
    expect(capturedPopstateHandler).not.toBeNull();

    (window.location as unknown as { href: string; pathname: string }).href =
      "http://localhost/about";
    (
      window.location as unknown as { href: string; pathname: string }
    ).pathname = "/about";

    await capturedPopstateHandler!();

    const pending = getNavigationSnapshot().pending;
    expect(pending?.pendingUrl.href).toBe("http://localhost/about");

    onHydrated({ source: "action", href: pending!.pendingUrl.href });
    expect(getNavigationSnapshot().pending?.id).toBe(pending!.id);

    onHydrated({ source: "navigation", href: "http://localhost/other" });
    expect(getNavigationSnapshot().pending?.id).toBe(pending!.id);

    onHydrated({ source: "navigation", href: pending!.pendingUrl.href });
    expect(getNavigationSnapshot().pending).toBeNull();
  });

  it("does not write to history state on scroll", () => {
    initClientNavigation();
    expect(capturedScrollHandler).not.toBeNull();
    vi.mocked(window.history.replaceState).mockClear();

    window.scrollY = 100;
    capturedScrollHandler!();
    window.scrollY = 200;
    capturedScrollHandler!();

    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("restores scroll from persisted history state after reload", () => {
    historyState = {
      [HISTORY_STATE_SCROLL_KEY]: "entry:1",
      scrollX: 9,
      scrollY: 321,
    };

    const { onHydrated } = initClientNavigation();
    onHydrated();

    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 9,
      top: 321,
      behavior: "instant",
    });
  });

  it("migrates legacy scrollX/scrollY state on boot", () => {
    historyState = { scrollX: 11, scrollY: 432 };

    const { onHydrated } = initClientNavigation();
    onHydrated();

    expect(window.history.replaceState).toHaveBeenCalledWith(
      expect.objectContaining({
        [HISTORY_STATE_SCROLL_KEY]: expect.any(String),
        scrollX: 11,
        scrollY: 432,
      }),
      "",
      "http://localhost/",
    );
    expect(window.scrollTo).toHaveBeenCalledWith({
      left: 11,
      top: 432,
      behavior: "instant",
    });
  });

  it("flushes the latest scroll position on pagehide for reload restoration", () => {
    initClientNavigation();
    expect(capturedScrollHandler).not.toBeNull();
    expect(capturedPagehideHandler).not.toBeNull();
    vi.mocked(window.history.replaceState).mockClear();

    window.scrollX = 3;
    window.scrollY = 250;
    capturedScrollHandler!();
    capturedPagehideHandler!();

    expect(window.history.replaceState).toHaveBeenCalledWith(
      expect.objectContaining({
        [HISTORY_STATE_SCROLL_KEY]: expect.any(String),
        scrollX: 3,
        scrollY: 250,
      }),
      "",
      "http://localhost/",
    );
  });

  it("flushes the latest scroll position when the page is hidden", () => {
    initClientNavigation();
    expect(capturedVisibilityChangeHandler).not.toBeNull();
    vi.mocked(window.history.replaceState).mockClear();

    window.scrollX = 5;
    window.scrollY = 275;
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    capturedVisibilityChangeHandler!();

    expect(window.history.replaceState).toHaveBeenCalledWith(
      expect.objectContaining({
        [HISTORY_STATE_SCROLL_KEY]: expect.any(String),
        scrollX: 5,
        scrollY: 275,
      }),
      "",
      "http://localhost/",
    );
  });
});
