export interface NavigationCacheEnvironment {
  isSecureContext: boolean;
  origin: string;
  caches?: CacheStorage;
  fetch: typeof fetch;
}

const NAVIGATION_CACHE_NAME = "rwsdk-navigation-v1";

function getBrowserNavigationCacheEnvironment():
  | NavigationCacheEnvironment
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  return {
    isSecureContext: window.isSecureContext,
    origin: window.location.origin,
    // CacheStorage is only available in secure contexts in supporting browsers.
    caches: "caches" in window ? window.caches : undefined,
    fetch: window.fetch.bind(window),
  };
}

/**
 * Preloads the RSC navigation response for a given URL into the Cache API.
 *
 * This issues a GET request with the `__rsc` query parameter set, and, on a
 * successful response, stores it in a versioned Cache using `cache.put`.
 *
 * See MDN for Cache interface semantics:
 * https://developer.mozilla.org/en-US/docs/Web/API/Cache
 */
export async function preloadNavigationUrl(
  rawUrl: URL | string,
  env?: NavigationCacheEnvironment,
): Promise<void> {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return;
  }

  const { isSecureContext, origin, caches, fetch } = runtimeEnv;

  // CacheStorage is only available in secure contexts, and may be evicted by
  // the browser at any time. We treat it as a best-effort optimization.
  if (!isSecureContext || !caches) {
    return;
  }

  try {
    const url =
      rawUrl instanceof URL ? new URL(rawUrl.toString()) : new URL(rawUrl, origin);

    if (url.origin !== origin) {
      // Only cache same-origin navigations.
      return;
    }

    // Ensure we are fetching the RSC navigation response.
    url.searchParams.set("__rsc", "");

    const request = new Request(url.toString(), {
      method: "GET",
      redirect: "manual",
    });

    const cache = await caches.open(NAVIGATION_CACHE_NAME);
    const response = await fetch(request);

    // Avoid caching obvious error responses; browsers may still evict entries
    // at any time, see MDN Cache docs for details.
    if (response.status >= 400) {
      return;
    }

    await cache.put(request, response.clone());
  } catch {
    // Best-effort optimization; never let cache failures break navigation.
    return;
  }
}

/**
 * Scan the document for `<link rel="preload" href="...">` elements that point
 * to same-origin paths and preload their RSC navigation responses into the
 * Cache API.
 *
 * This is invoked after client navigations to warm the navigation cache in
 * the background. We intentionally keep Cache usage write-only for now; reads
 * still go through the normal fetch path.
 */
export async function preloadFromLinkTags(
  doc: Document = document,
  env?: NavigationCacheEnvironment,
): Promise<void> {
  if (typeof doc === "undefined") {
    return;
  }

  const links = Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[rel="preload"][href]'),
  );

  await Promise.all(
    links.map((link) => {
      const href = link.getAttribute("href");

      if (!href) {
        return;
      }

      // Treat paths that start with "/" as route-like; assets (e.g. .js, .css)
      // are already handled by the existing modulepreload pipeline.
      if (!href.startsWith("/")) {
        return;
      }

      try {
        const url = new URL(href, env?.origin ?? window.location.origin);
        return preloadNavigationUrl(url, env);
      } catch {
        return;
      }
    }),
  );
}


