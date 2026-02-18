// Patch pushState/replaceState to dispatch events so usePathname stays reactive
// during rwsdk client-side navigation (pushState doesn't fire popstate).
if (typeof window !== "undefined") {
  for (const method of ["pushState", "replaceState"] as const) {
    const orig = history[method].bind(history);
    history[method] = (...args: Parameters<typeof history.pushState>) => {
      orig(...args);
      window.dispatchEvent(new Event("locationchange"));
    };
  }
}
