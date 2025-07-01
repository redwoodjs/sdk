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
      // should this only work for left click?
      if (event.button !== 0) {
        return;
      }

      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement;
      const link = target.closest("a");

      if (!link) {
        return;
      }

      const href = link.getAttribute("href");
      if (!href) {
        return;
      }

      // Skip if target="_blank" or similar
      if (link.target && link.target !== "_self") {
        return;
      }

      // Skip if download attribute
      if (link.hasAttribute("download")) {
        return;
      }

      if (href.startsWith("http")) {
        return;
      }

      // Prevent default navigation
      event.preventDefault();

      // push this to the history stack.
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
