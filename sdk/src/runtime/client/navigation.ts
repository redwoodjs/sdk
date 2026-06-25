import {
  onNavigationCommit,
  preloadFromLinkTags,
  type NavigationCache,
  type NavigationCacheStorage,
} from "./navigationCache.js";
import {
  abortPendingNavigation,
  beginPendingNavigation,
  commitPendingNavigation,
  isPendingNavigationCommit,
} from "./navigationState.js";
import {
  createScrollRestoration,
  type ScrollRestorationController,
} from "./scrollRestoration.js";
import type { RscPayloadMeta } from "./types.js";

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

let scrollRestoration: ScrollRestorationController | null = null;
let currentPathKey: string | null = null;

function getLocationPathKey() {
  return `${window.location.pathname ?? ""}${window.location.search ?? ""}`;
}

function getUrlPathKey(url: URL) {
  return `${url.pathname ?? ""}${url.search ?? ""}` || getLocationPathKey();
}

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

  const url = new URL(href, window.location.href);

  const scrollToTop = options.info?.scrollToTop ?? true;
  const scrollBehavior = (options.info?.scrollBehavior ??
    "instant") as ScrollBehavior;
  const nextScrollPosition = scrollToTop
    ? { x: 0, y: 0 }
    : { x: window.scrollX, y: window.scrollY };

  if (options.history === "push") {
    scrollRestoration?.pushEntry(href, url, nextScrollPosition);
  } else {
    scrollRestoration?.replaceEntry(href, url, nextScrollPosition);
  }
  currentPathKey = getUrlPathKey(url);

  if (scrollToTop) {
    scrollRestoration?.setPendingScroll({
      ...nextScrollPosition,
      behavior: scrollBehavior,
    });
  } else {
    scrollRestoration?.recordCurrentPosition(window.scrollX, window.scrollY);
  }

  const pendingNavigation = beginPendingNavigation(url);

  try {
    await options.onNavigate?.();

    await globalThis.__rsc_callServer(null, null, "navigation");
  } catch (error) {
    abortPendingNavigation(pendingNavigation.id);
    throw error;
  }
}

/**
 * Initializes client-side navigation for Single Page App (SPA) behavior.
 *
 * Intercepts clicks on internal links and fetches page content without full-page reloads.
 * Returns handleResponse and onHydrated functions to pass to initClient.
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
 * const { handleResponse, onHydrated } = initClientNavigation({
 *   scrollBehavior: "smooth",
 *   scrollToTop: true,
 * });
 * initClient({ handleResponse, onHydrated });
 *
 * @example
 * // Preserve scroll position (e.g., for infinite scroll)
 * const { handleResponse, onHydrated } = initClientNavigation({
 *   scrollToTop: false,
 * });
 * initClient({ handleResponse, onHydrated });
 *
 * @example
 * // With navigation callback
 * const { handleResponse, onHydrated } = initClientNavigation({
 *   onNavigate: () => {
 *     console.log("Navigating to:", window.location.href);
 *   },
 * });
 * initClient({ handleResponse, onHydrated });
 */
export function initClientNavigation(opts: ClientNavigationOptions = {}) {
  IS_CLIENT_NAVIGATION = true;
  scrollRestoration = createScrollRestoration();
  scrollRestoration.initialize();
  currentPathKey = getLocationPathKey();

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
    const nextPathKey = getLocationPathKey();
    const isHashOnlyChange = nextPathKey === currentPathKey;
    currentPathKey = nextPathKey;

    if (isHashOnlyChange) {
      return;
    }

    scrollRestoration?.restorePopStateScroll();
    const pendingNavigation = beginPendingNavigation(window.location.href);

    try {
      await opts.onNavigate?.();
      await globalThis.__rsc_callServer(null, null, "navigation");
    } catch (error) {
      abortPendingNavigation(pendingNavigation.id);
      throw error;
    }
  });

  // Track the user's scroll position in memory so back/forward navigation can
  // restore it after the RSC payload commits. Avoid writing on every scroll via
  // history.replaceState because browsers throttle frequent history updates.
  window.addEventListener(
    "scroll",
    () => {
      scrollRestoration?.recordCurrentPosition(window.scrollX, window.scrollY);
    },
    { passive: true },
  );

  let didFlushForHiddenPage = false;
  function flushForPageLifecycle() {
    if (didFlushForHiddenPage) {
      return;
    }

    didFlushForHiddenPage = true;
    scrollRestoration?.flushCurrentPositionToHistoryState();
  }

  window.addEventListener("pagehide", flushForPageLifecycle);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushForPageLifecycle();
    } else {
      didFlushForHiddenPage = false;
    }
  });

  function handleResponse(response: Response): boolean {
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        abortPendingNavigation();
        window.location.href = location;
        return false;
      }
    }

    if (!response.ok) {
      // Redirect to the current page (window.location) to show the error
      // This means the page that produced the error is called twice.
      abortPendingNavigation();
      window.location.href = window.location.href;
      return false;
    }
    return true;
  }

  // Store cacheStorage globally for use in client.tsx
  if (opts.cacheStorage && typeof globalThis !== "undefined") {
    (globalThis as any).__rsc_cacheStorage = opts.cacheStorage;
  }

  function onHydrated(meta?: RscPayloadMeta) {
    // Apply any pending scroll intent once the relevant DOM has committed. For
    // navigation payloads, ignore stale/superseded commits whose href no longer
    // matches the pending navigation target.
    const shouldCommitPendingNavigation = !meta || meta.source === "navigation";
    const isMatchingNavigationCommit =
      shouldCommitPendingNavigation && isPendingNavigationCommit(meta?.href);

    if (!meta || meta.source === "initial" || isMatchingNavigationCommit) {
      scrollRestoration?.applyPendingScroll();
    }

    // Resolve NavigationPending boundaries only for navigation payloads. If a
    // custom transport does not provide metadata, fall back to the historical
    // onHydrated behavior and treat the commit as the pending navigation.
    if (isMatchingNavigationCommit) {
      commitPendingNavigation(meta?.href);
    }

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
