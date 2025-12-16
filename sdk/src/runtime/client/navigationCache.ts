export interface NavigationCacheEnvironment {
  isSecureContext: boolean;
  origin: string;
  caches?: CacheStorage;
  fetch: typeof fetch;
}

// Type declaration for requestIdleCallback (may not be in all TypeScript environments)
declare function requestIdleCallback(
  callback: () => void,
  options?: { timeout?: number },
): number;

interface NavigationCacheState {
  tabId: string;
  generation: number;
  buildId: string;
}

const TAB_ID_STORAGE_KEY = "rwsdk-navigation-tab-id";
const BUILD_ID = "rwsdk"; // Stable build identifier

let cacheState: NavigationCacheState | null = null;

function getOrInitializeCacheState(): NavigationCacheState {
  if (cacheState) {
    return cacheState;
  }

  // Get or generate tabId
  let tabId: string;
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      const stored = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
      if (stored) {
        tabId = stored;
      } else {
        tabId = crypto.randomUUID();
        sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
      }
    } catch {
      // Fallback to in-memory tabId if sessionStorage is unavailable
      tabId = crypto.randomUUID();
    }
  } else {
    // Fallback for non-browser environments
    tabId = crypto.randomUUID();
  }

  cacheState = {
    tabId,
    generation: 0,
    buildId: BUILD_ID,
  };

  return cacheState;
}

function getCurrentCacheName(): string {
  const state = getOrInitializeCacheState();
  return `rsc-prefetch:${state.buildId}:${state.tabId}:${state.generation}`;
}

function incrementGeneration(): number {
  const state = getOrInitializeCacheState();
  state.generation++;
  return state.generation;
}

function getCurrentGeneration(): number {
  const state = getOrInitializeCacheState();
  return state.generation;
}

function getTabId(): string {
  const state = getOrInitializeCacheState();
  return state.tabId;
}

function getBuildId(): string {
  const state = getOrInitializeCacheState();
  return state.buildId;
}

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

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[rwsdk:navigationCache] preloadNavigationUrl called", {
      rawUrl: rawUrl instanceof URL ? rawUrl.toString() : rawUrl,
      origin,
      hasCaches: Boolean(caches),
      isSecureContext,
    });
  }

  // CacheStorage is only available in secure contexts, and may be evicted by
  // the browser at any time. We treat it as a best-effort optimization.
  if (!isSecureContext || !caches) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(
        "[rwsdk:navigationCache] skipping preloadNavigationUrl: insecure context or no CacheStorage",
      );
    }
    return;
  }

  try {
    const url =
      rawUrl instanceof URL
        ? new URL(rawUrl.toString())
        : new URL(rawUrl, origin);

    if (url.origin !== origin) {
      // Only cache same-origin navigations.
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug(
          "[rwsdk:navigationCache] skipping preloadNavigationUrl: cross-origin URL",
          url.toString(),
        );
      }
      return;
    }

    // Ensure we are fetching the RSC navigation response.
    url.searchParams.set("__rsc", "");

    const request = new Request(url.toString(), {
      method: "GET",
      redirect: "manual",
    });

    const cacheName = getCurrentCacheName();
    const cache = await caches.open(cacheName);
    const response = await fetch(request);

    // Avoid caching obvious error responses; browsers may still evict entries
    // at any time, see MDN Cache docs for details.
    if (response.status >= 400) {
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug(
          "[rwsdk:navigationCache] not caching navigation response due to error status",
          response.status,
        );
      }
      return;
    }

    await cache.put(request, response.clone());
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(
        "[rwsdk:navigationCache] cached navigation response for",
        request.url,
      );
    }
  } catch (error) {
    // Best-effort optimization; never let cache failures break navigation.
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(
        "[rwsdk:navigationCache] error during preloadNavigationUrl; ignoring",
        error,
      );
    }
    return;
  }
}

/**
 * Attempts to retrieve a cached navigation response for the given URL.
 *
 * Returns the cached Response if found, or undefined if not cached or if
 * CacheStorage is unavailable.
 */
export async function getCachedNavigationResponse(
  rawUrl: URL | string,
  env?: NavigationCacheEnvironment,
): Promise<Response | undefined> {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return undefined;
  }

  const { isSecureContext, origin, caches } = runtimeEnv;

  if (!isSecureContext || !caches) {
    return undefined;
  }

  try {
    const url =
      rawUrl instanceof URL
        ? new URL(rawUrl.toString())
        : new URL(rawUrl, origin);

    if (url.origin !== origin) {
      // Only cache same-origin navigations.
      return undefined;
    }

    // Ensure we are matching the RSC navigation response.
    url.searchParams.set("__rsc", "");

    const request = new Request(url.toString(), {
      method: "GET",
      redirect: "manual",
    });

    const cacheName = getCurrentCacheName();
    const cache = await caches.open(cacheName);
    const cachedResponse = await cache.match(request);

    if (process.env.NODE_ENV === "development" && cachedResponse) {
      // eslint-disable-next-line no-console
      console.debug("[rwsdk:navigationCache] cache hit for", request.url);
    }

    return cachedResponse ?? undefined;
  } catch (error) {
    // Best-effort optimization; never let cache failures break navigation.
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.debug(
        "[rwsdk:navigationCache] error during getCachedNavigationResponse; ignoring",
        error,
      );
    }
    return undefined;
  }
}

/**
 * Cleans up old generation caches for the current tab.
 *
 * This should be called after navigation commits to evict cache entries from
 * previous navigations. It runs asynchronously via requestIdleCallback or
 * setTimeout to avoid blocking the critical path.
 */
export async function evictOldGenerationCaches(
  env?: NavigationCacheEnvironment,
): Promise<void> {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return;
  }

  const { isSecureContext, caches } = runtimeEnv;

  if (!isSecureContext || !caches) {
    return;
  }

  const currentGeneration = getCurrentGeneration();
  const tabId = getTabId();
  const buildId = getBuildId();

  // Schedule cleanup in idle time to avoid blocking navigation
  const cleanup = async () => {
    try {
      // List all cache names
      const cacheNames = await caches.keys();
      const prefix = `rsc-prefetch:${buildId}:${tabId}:`;

      // Find all caches for this tab
      const tabCaches = cacheNames.filter((name) => name.startsWith(prefix));

      // Delete caches with generation numbers less than current
      const deletePromises = tabCaches.map((cacheName) => {
        const match = cacheName.match(new RegExp(`${prefix}(\\d+)$`));
        if (match) {
          const generation = parseInt(match[1]!, 10);
          if (generation < currentGeneration) {
            if (process.env.NODE_ENV === "development") {
              // eslint-disable-next-line no-console
              console.debug(
                "[rwsdk:navigationCache] deleting old generation cache",
                cacheName,
              );
            }
            return caches.delete(cacheName);
          }
        }
        return Promise.resolve(false);
      });

      await Promise.all(deletePromises);
    } catch (error) {
      // Best-effort cleanup; never let failures break navigation.
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.debug(
          "[rwsdk:navigationCache] error during evictOldGenerationCaches; ignoring",
          error,
        );
      }
    }
  };

  // Use requestIdleCallback if available, otherwise setTimeout
  if (typeof requestIdleCallback !== "undefined") {
    requestIdleCallback(cleanup, { timeout: 5000 });
  } else {
    setTimeout(cleanup, 0);
  }
}

/**
 * Increments the generation counter and schedules cleanup of old caches.
 *
 * This should be called after navigation commits to mark the current generation
 * as complete and prepare for the next navigation cycle.
 */
export function onNavigationCommit(env?: NavigationCacheEnvironment): void {
  incrementGeneration();
  void evictOldGenerationCaches(env);
}

/**
 * Scan the document for `<link rel="prefetch" href="...">` elements that point
 * to same-origin paths and prefetch their RSC navigation responses into the
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
    doc.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"][href]'),
  );

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug(
      "[rwsdk:navigationCache] found prefetch links",
      links.map((link) => link.getAttribute("href")),
    );
  }

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
