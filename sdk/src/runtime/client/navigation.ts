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

  const url = window.location.origin + href;

  if (options.history === "push") {
    window.history.pushState({ path: href }, "", url);
  } else {
    window.history.replaceState({ path: href }, "", url);
  }

  // @ts-expect-error
  await globalThis.__rsc_callServer();

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

      navigate(href);
    },
    true,
  );

  window.addEventListener("popstate", async function handlePopState() {
    // @ts-expect-error
    await globalThis.__rsc_callServer();
  });

  // Return a handleResponse function for use with initClient
  return {
    handleResponse: function handleResponse(response: Response): boolean {
      if (!response.ok) {
        // Redirect to the current page (window.location) to show the error
        // This means the page that produced the error is called twice.
        window.location.href = window.location.href;
        return false;
      }
      return true;
    },
  };
}
