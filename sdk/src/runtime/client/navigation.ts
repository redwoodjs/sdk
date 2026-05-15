import {
  onNavigationCommit,
  preloadFromLinkTags,
  type NavigationCache,
  type NavigationCacheStorage,
} from "./navigationCache.js";

export type { NavigationCache, NavigationCacheStorage };

export interface ClientNavigationOptions {
  onNavigate?: () => Promise<void> | void;
  scrollToTop?: boolean;
  scrollBehavior?: "auto" | "smooth" | "instant";
  cacheStorage?: NavigationCacheStorage;
}

export function validateClickEvent(event: MouseEvent, target: HTMLElement) {
  // should this only work for left click?
  if (event.button !== 0) {
    return false;
  }

  if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
    return false;
  }

  const link = target.closest("a");

  if (!link) {
    return false;
  }

  const href = link.getAttribute("href");
  if (!href) {
    return false;
  }

  if (href.includes("#")) {
    return false;
  }

  // Skip if target="_blank" or similar
  if (link.target && link.target !== "_self") {
    return false;
  }

  if (href.startsWith("http")) {
    return false;
  }

  // Skip if download attribute
  if (link.hasAttribute("download")) {
    return false;
  }

  return true;
}

let IS_CLIENT_NAVIGATION = false;

type PendingScroll = {
  x: number;
  y: number;
  behavior: ScrollBehavior;
};

// Scroll intent recorded at navigation time and applied post-commit in
// onHydrated, so the new scroll position aligns with the new DOM rather
// than flashing on top of the old one.
let pendingScroll: PendingScroll | null = null;

export interface NavigateOptions {
  history?: "push" | "replace";
  onNavigate?: () => Promise<void> | void;
  info?: {
    scrollToTop?: boolean;
    scrollBehavior?: "auto" | "smooth" | "instant";
  };
}

export async function navigate(
  href: string,
  options: NavigateOptions = { history: "push" },
) {
  if (!IS_CLIENT_NAVIGATION) {
    window.location.href = href;
    return;
  }

  saveScrollPosition(window.scrollX, window.scrollY);

  const url = new URL(href, window.location.href);

  if (options.history === "push") {
    window.history.pushState({ path: href }, "", url);
  } else {
    window.history.replaceState({ path: href }, "", url);
  }

  const scrollToTop = options.info?.scrollToTop ?? true;
  const scrollBehavior = (options.info?.scrollBehavior ??
    "instant") as ScrollBehavior;

  if (scrollToTop) {
    pendingScroll = { x: 0, y: 0, behavior: scrollBehavior };
  }

  await options.onNavigate?.();

  await globalThis.__rsc_callServer(null, null, "navigation");
}

function saveScrollPosition(x: number, y: number) {
  window.history.replaceState(
    {
      ...window.history.state,
      scrollX: x,
      scrollY: y,
    },
    "",
    window.location.href,
  );
}

function applyPendingScroll() {
  if (!pendingScroll) return;
  const { x, y, behavior } = pendingScroll;
  pendingScroll = null;
  window.scrollTo({ top: y, left: x, behavior });
  saveScrollPosition(x, y);
}

/**
 * Initializes client-side navigation for Single Page App (SPA) behavior.
 *
 * Intercepts clicks on internal links and fetches page content without full-page reloads.
 * Returns a handleResponse function to pass to initClient.
 *
 * @param opts.scrollToTop - Scroll to top after navigation (default: true)
 * @param opts.scrollBehavior - How to scroll: 'instant', 'smooth', or 'auto' (default: 'instant')
 * @param opts.onNavigate - Callback executed after history push but before RSC fetch
 *
 * @example
 * // Basic usage
 * import { initClient, initClientNavigation } from "rwsdk/client";
 *
 * const { handleResponse, onHydrated } = initClientNavigation();
 * initClient({ handleResponse, onHydrated });
 *
 * @example
 * // With custom scroll behavior
 * const { handleResponse } = initClientNavigation({
 *   scrollBehavior: "smooth",
 *   scrollToTop: true,
 * });
 * initClient({ handleResponse });
 *
 * @example
 * // Preserve scroll position (e.g., for infinite scroll)
 * const { handleResponse } = initClientNavigation({
 *   scrollToTop: false,
 * });
 * initClient({ handleResponse });
 *
 * @example
 * // With navigation callback
 * const { handleResponse } = initClientNavigation({
 *   onNavigate: () => {
 *     console.log("Navigating to:", window.location.href);
 *   },
 * });
 * initClient({ handleResponse });
 */
export function initClientNavigation(opts: ClientNavigationOptions = {}) {
  IS_CLIENT_NAVIGATION = true;
  // Take manual control of scroll restoration. With "auto", the browser
  // restores scroll immediately on popstate — before the RSC payload has
  // committed — which causes the old DOM to flash at the new scroll offset.
  history.scrollRestoration = "manual";

  // If we're booting onto an entry that already has a saved scroll (e.g.
  // a reload after scrolling, or a back-forward cache restore), queue that
  // position so the first commit lands us where the user left off.
  const bootState = window.history.state;
  if (
    bootState &&
    (typeof bootState.scrollX === "number" ||
      typeof bootState.scrollY === "number")
  ) {
    pendingScroll = {
      x: bootState.scrollX ?? 0,
      y: bootState.scrollY ?? 0,
      behavior: "instant",
    };
  }

  document.addEventListener(
    "click",
    async function handleClickEvent(event: MouseEvent) {
      if (!validateClickEvent(event, event.target as HTMLElement)) {
        return;
      }

      event.preventDefault();

      const el = event.target as HTMLElement;
      const a = el.closest("a");
      const href = a?.getAttribute("href") as string;

      await navigate(href, { history: "push", onNavigate: opts.onNavigate });
    },
    true,
  );

  window.addEventListener("popstate", async function handlePopState() {
    const state = window.history.state ?? {};
    pendingScroll = {
      x: typeof state.scrollX === "number" ? state.scrollX : 0,
      y: typeof state.scrollY === "number" ? state.scrollY : 0,
      behavior: "instant",
    };
    await opts.onNavigate?.();
    await globalThis.__rsc_callServer(null, null, "navigation");
  });

  // Persist the user's scroll position on the current history entry so
  // that back/forward navigation can restore it accurately once the new
  // RSC payload commits. Coalesced via rAF to avoid thrashing replaceState.
  let scrollSaveScheduled = false;
  window.addEventListener(
    "scroll",
    () => {
      if (scrollSaveScheduled) return;
      scrollSaveScheduled = true;
      requestAnimationFrame(() => {
        scrollSaveScheduled = false;
        saveScrollPosition(window.scrollX, window.scrollY);
      });
    },
    { passive: true },
  );

  function handleResponse(response: Response): boolean {
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        window.location.href = location;
        return false;
      }
    }

    if (!response.ok) {
      // Redirect to the current page (window.location) to show the error
      // This means the page that produced the error is called twice.
      window.location.href = window.location.href;
      return false;
    }
    return true;
  }

  // Store cacheStorage globally for use in client.tsx
  if (opts.cacheStorage && typeof globalThis !== "undefined") {
    (globalThis as any).__rsc_cacheStorage = opts.cacheStorage;
  }

  function onHydrated() {
    // Apply any pending scroll intent now that React has committed the new
    // DOM — this is what prevents the scroll flash on both link-click and
    // popstate navigations.
    applyPendingScroll();
    // After each RSC hydration/update, increment generation and evict old caches,
    // then warm the navigation cache based on any <link rel="x-prefetch"> tags
    // rendered for the current location.
    onNavigationCommit(undefined, opts.cacheStorage);
    void preloadFromLinkTags(undefined, undefined, opts.cacheStorage);
  }

  // Return callbacks for use with initClient
  return {
    handleResponse,
    onHydrated,
  };
}
