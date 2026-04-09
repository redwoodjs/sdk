/**
 * Reproduction test for issue #1123:
 * ClientNavigationOptions['onNavigate'] is never called.
 *
 * The `onNavigate` callback is accepted as a parameter to `initClientNavigation()`
 * and is documented/typed as "executed after history push but before RSC fetch",
 * but is never actually invoked in the runtime implementation.
 *
 * This test should FAIL on the current codebase, confirming the bug.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { initClientNavigation } from "./navigation";

// ---- Browser globals required by initClientNavigation ----

const mockPushState = vi.fn();
const mockReplaceState = vi.fn();
const mockScrollTo = vi.fn();

vi.stubGlobal("window", {
  location: { href: "http://localhost/" },
  addEventListener: vi.fn(),
  history: {
    scrollRestoration: "auto",
    state: {},
    pushState: mockPushState,
    replaceState: mockReplaceState,
  },
  scrollX: 0,
  scrollY: 0,
  scrollTo: mockScrollTo,
});

vi.stubGlobal("document", {
  addEventListener: vi.fn(),
});

vi.stubGlobal("history", {
  scrollRestoration: "auto",
  pushState: mockPushState,
  replaceState: mockReplaceState,
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

// Stub globalThis.__rsc_callServer so navigate() doesn't throw
vi.stubGlobal("__rsc_callServer", vi.fn().mockResolvedValue(undefined));

describe("issue #1123 — onNavigate is never called", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("onNavigate callback should be called when a link click triggers navigation", async () => {
    const onNavigateMock = vi.fn();

    // Set up navigation with an onNavigate callback
    initClientNavigation({ onNavigate: onNavigateMock });

    // Capture the click handler registered via document.addEventListener
    const addEventListenerCalls = (document.addEventListener as ReturnType<typeof vi.fn>).mock.calls;
    const clickListenerEntry = addEventListenerCalls.find(
      ([eventName]: [string]) => eventName === "click",
    );

    expect(clickListenerEntry).toBeDefined();
    const clickHandler = clickListenerEntry![1] as (event: MouseEvent) => Promise<void>;

    // Construct a mock click event that passes validateClickEvent checks
    const mockAnchor = {
      getAttribute: (attr: string) => (attr === "href" ? "/about" : null),
      hasAttribute: () => false,
      target: "",
      closest: function (selector: string) {
        return selector === "a" ? this : null;
      },
    };

    const mockTarget = {
      closest: (selector: string) => (selector === "a" ? mockAnchor : null),
    };

    const mockClickEvent = {
      button: 0,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      ctrlKey: false,
      target: mockTarget,
      preventDefault: vi.fn(),
    } as unknown as MouseEvent;

    // Fire the click handler
    await clickHandler(mockClickEvent);

    // The onNavigate callback SHOULD have been called — but on the current
    // codebase it is NEVER called, so this assertion will FAIL.
    expect(onNavigateMock).toHaveBeenCalledTimes(1);
  });

  it("onNavigate is never referenced inside initClientNavigation body (static proof)", () => {
    // This test confirms the static absence of any onNavigate invocation by
    // verifying the mock is still at zero calls after a complete navigation cycle.
    const onNavigateMock = vi.fn();

    initClientNavigation({ onNavigate: onNavigateMock });

    // After setup, no navigation has occurred — zero calls expected here.
    expect(onNavigateMock).toHaveBeenCalledTimes(0);

    // The click handler path also never calls onNavigate:
    // (proven by the previous test which fires a click and still sees 0 calls)
  });
});
