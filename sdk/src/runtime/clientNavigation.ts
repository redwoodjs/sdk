export interface ClientNavigationOptions {
  onNavigate?: () => void;
  scrollToTop?: boolean;
  scrollBehavior?: "auto" | "smooth" | "instant";
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
  const options: Required<ClientNavigationOptions> = {
    onNavigate: async function onNavigate() {
      // @ts-expect-error
      await globalThis.__rsc_callServer();
    },
    scrollToTop: true,
    scrollBehavior: "instant",
    ...opts,
  };

  history.scrollRestoration = "auto";

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

      saveScrollPosition(window.scrollX, window.scrollY);

      window.history.pushState(
        { path: href },
        "",
        window.location.origin + href,
      );

      await options.onNavigate();

      if (options.scrollToTop && history.scrollRestoration === "auto") {
        window.scrollTo({
          top: 0,
          left: 0,
          behavior: options.scrollBehavior,
        });
        saveScrollPosition(0, 0);
      }
      history.scrollRestoration = "auto";
    },
    true,
  );

  window.addEventListener("popstate", async function handlePopState() {
    saveScrollPosition(window.scrollX, window.scrollY);
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
