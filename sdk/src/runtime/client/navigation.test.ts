import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateClickEvent, initClientNavigation, navigate } from "./navigation";

// Mocking browser globals
vi.stubGlobal("window", {
  location: { href: "http://localhost/" },
  addEventListener: vi.fn(),
  history: { scrollRestoration: "auto" },
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

// Reproduction test for issue #1123:
// ClientNavigationOptions['onNavigate'] is never called
describe("onNavigate callback (issue #1123 reproduction)", () => {
  let capturedClickHandler: ((event: MouseEvent) => void) | null = null;
  let capturedPopstateHandler: (() => void) | null = null;

  beforeEach(() => {
    capturedClickHandler = null;
    capturedPopstateHandler = null;
    vi.clearAllMocks();

    // Capture registered event listeners so we can invoke them manually
    vi.stubGlobal("document", {
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === "click") capturedClickHandler = handler;
      }),
    });
    vi.stubGlobal("window", {
      location: { href: "http://localhost/" },
      addEventListener: vi.fn((event: string, handler: any) => {
        if (event === "popstate") capturedPopstateHandler = handler;
      }),
      history: {
        scrollRestoration: "auto",
        pushState: vi.fn(),
        replaceState: vi.fn(),
        state: {},
      },
      scrollTo: vi.fn(),
    });
    vi.stubGlobal("history", {
      scrollRestoration: "auto",
      pushState: vi.fn(),
      replaceState: vi.fn(),
      state: {},
    });
    vi.stubGlobal("URL", class {
      href: string;
      constructor(path: string, base: string) {
        this.href = base.replace(/\/$/, "") + path;
      }
    });
    // Assign directly to globalThis without replacing it (avoids breaking Vitest internals)
    (globalThis as any).__rsc_callServer = vi.fn().mockResolvedValue(undefined);
  });

  it("REPRODUCES ISSUE #1123: onNavigate is NOT called during link click navigation", async () => {
    const onNavigate = vi.fn();

    // Initialize navigation with the onNavigate callback
    initClientNavigation({ onNavigate });

    // Confirm the click handler was registered
    expect(capturedClickHandler).not.toBeNull();

    // Build a fake click event on an anchor element
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

    // Fire the captured click handler
    await capturedClickHandler!(fakeClickEvent);

    // onNavigate SHOULD have been called (but per issue #1123, it is not)
    // This assertion FAILS, confirming the bug:
    expect(onNavigate).toHaveBeenCalled();
  });

  it("REPRODUCES ISSUE #1123: onNavigate is NOT called during popstate navigation", async () => {
    const onNavigate = vi.fn();

    initClientNavigation({ onNavigate });

    expect(capturedPopstateHandler).not.toBeNull();

    // Trigger a popstate (back/forward navigation)
    await capturedPopstateHandler!();

    // onNavigate SHOULD have been called (but per issue #1123, it is not)
    // This assertion FAILS, confirming the bug:
    expect(onNavigate).toHaveBeenCalled();
  });
});

describe("initClientNavigation", () => {
  beforeEach(() => {
    window.location.href = "http://localhost/";
    vi.clearAllMocks();
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
});
