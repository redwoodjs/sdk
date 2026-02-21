import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateClickEvent, initClientNavigation } from "./navigation";

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
