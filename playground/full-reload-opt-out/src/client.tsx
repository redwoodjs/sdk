import { initClient, initClientNavigation } from "rwsdk/client";

// Set a per-load token so E2E tests can detect full page reloads vs soft
// client navigations.
if (typeof window !== "undefined") {
  (window as any).__rwsdk_load_token = crypto.randomUUID();
}

function isAdminUrl(url: URL) {
  return url.pathname.startsWith("/admin");
}

const { handleResponse, onHydrated } = initClientNavigation({
  shouldIntercept({ toUrl, fromUrl }) {
    // Force a full reload whenever we cross in or out of the /admin section,
    // because that section uses a different Document / client program.
    return isAdminUrl(toUrl) === isAdminUrl(fromUrl);
  },
});

initClient({ handleResponse, onHydrated });
