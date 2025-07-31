export interface ClientNavigationOptions {
  onNavigate?: () => void;
  scrollToTop?: boolean;
  scrollBehavior?: "auto" | "smooth" | "instant";
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

export function initClientNavigation(opts: ClientNavigationOptions = {}) {
  // Merge user options with defaults
  const options: Required<ClientNavigationOptions> = {
    onNavigate: async function onNavigate() {
      // @ts-expect-error
      await globalThis.__rsc_callServer();
    },
    scrollToTop: true,
    scrollBehavior: "instant",
    ...opts,
  };

  // Prevent browser's automatic scroll restoration for popstate
  if ("scrollRestoration" in history) {
    history.scrollRestoration = "manual";
  }

  // Set up scroll behavior management
  let popStateWasCalled = false;
  let savedScrollPosition: { x: number; y: number } | null = null;

  const observer = new MutationObserver(() => {
    if (popStateWasCalled && savedScrollPosition) {
      // Restore scroll position for popstate navigation (always instant)
      window.scrollTo({
        top: savedScrollPosition.y,
        left: savedScrollPosition.x,
        behavior: "instant",
      });
      savedScrollPosition = null;
    } else if (options.scrollToTop && !popStateWasCalled) {
      // Scroll to top for anchor click navigation (configurable)
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: options.scrollBehavior,
      });

      // Update the current history entry with the new scroll position (top)
      // This ensures that if we navigate back and then forward again,
      // we return to the top position, not some previous scroll position
      window.history.replaceState(
        {
          ...window.history.state,
          scrollX: 0,
          scrollY: 0,
        },
        "",
        window.location.href,
      );
    }
    popStateWasCalled = false;
  });

  const handleScrollPopState = (event: PopStateEvent) => {
    popStateWasCalled = true;
    // Save the scroll position that the browser would have restored to
    const state = event.state;
    if (
      state &&
      typeof state === "object" &&
      "scrollX" in state &&
      "scrollY" in state
    ) {
      savedScrollPosition = { x: state.scrollX, y: state.scrollY };
    } else {
      // Fallback: try to get scroll position from browser's session history
      // This is a best effort since we can't directly access the browser's stored position
      savedScrollPosition = { x: window.scrollX, y: window.scrollY };
    }
  };

  const main = document.querySelector("main") || document.body;
  if (main) {
    window.addEventListener("popstate", handleScrollPopState);
    observer.observe(main, { childList: true, subtree: true });
  }

  // Intercept all anchor tag clicks
  document.addEventListener(
    "click",
    async function handleClickEvent(event: MouseEvent) {
      // Prevent default navigation

      if (!validateClickEvent(event, event.target as HTMLElement)) {
        return;
      }

      event.preventDefault();

      const el = event.target as HTMLElement;
      const a = el.closest("a");
      const href = a?.getAttribute("href") as string;

      // Save current scroll position before navigating
      window.history.replaceState(
        {
          path: window.location.pathname,
          scrollX: window.scrollX,
          scrollY: window.scrollY,
        },
        "",
        window.location.href,
      );

      window.history.pushState(
        { path: href },
        "",
        window.location.origin + href,
      );

      await options.onNavigate();
    },
    true,
  );

  // Handle browser back/forward buttons
  window.addEventListener("popstate", async function handlePopState() {
    await options.onNavigate();
  });

  // Return a handleResponse function for use with initClient
  return {
    handleResponse: function handleResponse(response: Response): boolean {
      if (!response.ok) {
        // Redirect to the current page (window.location) to show the error
        window.location.href = window.location.href;
        return false;
      }
      return true;
    },
  };
}
