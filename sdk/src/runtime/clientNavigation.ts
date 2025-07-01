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

export function initClientNavigation(
  opts: {
    onNavigate: () => void;
  } = {
    onNavigate: async function onNavigate() {
      // @ts-expect-error
      await globalThis.__rsc_callServer();
    },
  },
) {
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

      window.history.pushState(
        { path: href },
        "",
        window.location.origin + href,
      );

      await opts.onNavigate();
    },
    true,
  );

  // Handle browser back/forward buttons
  window.addEventListener("popstate", async function handlePopState() {
    await opts.onNavigate();
  });
}
