import {
  onNavigationCommit,
  preloadFromLinkTags,
  type NavigationCache,
  type NavigationCacheStorage,
} from "./navigationCache.js";

export type { NavigationCache, NavigationCacheStorage };

export interface ClientNavigationOptions {
  onNavigate?: () => void;
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

export interface NavigateOptions {
  history?: "push" | "replace";
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

  await globalThis.__rsc_callServer(null, null, "navigation");

  const scrollToTop = options.info?.scrollToTop ?? true;
  const scrollBehavior = options.info?.scrollBehavior ?? "instant";

  if (scrollToTop && history.scrollRestoration === "auto") {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: scrollBehavior,
    });
    saveScrollPosition(0, 0);
  }
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
  history.scrollRestoration = "auto";

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

      await navigate(href);
    },
    true,
  );

  window.addEventListener("popstate", async function handlePopState() {
    await globalThis.__rsc_callServer(null, null, "navigation");
  });

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
