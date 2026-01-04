export interface NavigationCacheEnvironment {
  isSecureContext: boolean;
  origin: string;
  caches?: CacheStorage;
  fetch: typeof fetch;
}

/**
 * Interface for a single cache instance, mirroring the Cache API.
 */
export interface NavigationCache {
  put(request: Request, response: Response): Promise<void>;
  match(request: Request): Promise<Response | undefined>;
}

/**
 * Interface for cache storage, mirroring the CacheStorage API.
 */
export interface NavigationCacheStorage {
  open(cacheName: string): Promise<NavigationCache>;
  delete(cacheName: string): Promise<boolean>;
  keys(): Promise<string[]>;
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

  let tabId: string | null = null;

  if (typeof window !== "undefined") {
    try {
      tabId = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
      if (!tabId) {
        tabId = `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
        sessionStorage.setItem(TAB_ID_STORAGE_KEY, tabId);
      }
    } catch {
      // sessionStorage might be unavailable
      tabId = tabId || `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }
  }

  cacheState = {
    tabId: tabId || "1",
    generation: 0,
    buildId: BUILD_ID,
  };

  return cacheState;
}

function getCurrentCacheName(): string {
  const state = getOrInitializeCacheState();
  return `rsc-x-prefetch:${state.buildId}:${state.tabId}:${state.generation}`;
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
 * Creates a default NavigationCacheStorage implementation that wraps the browser's CacheStorage API.
 * This maintains the current generation-based cache naming and eviction logic.
 */
export function createDefaultNavigationCacheStorage(
  env?: NavigationCacheEnvironment,
): NavigationCacheStorage | undefined {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return undefined;
  }

  const { caches } = runtimeEnv;

  if (!caches) {
    return undefined;
  }

  return {
    async open(cacheName: string): Promise<NavigationCache> {
      const cache = await caches.open(cacheName);
      return {
        async put(request: Request, response: Response): Promise<void> {
          await cache.put(request, response);
        },
        async match(request: Request): Promise<Response | undefined> {
          return (await cache.match(request)) ?? undefined;
        },
      };
    },
    async delete(cacheName: string): Promise<boolean> {
      return await caches.delete(cacheName);
    },
    async keys(): Promise<string[]> {
      return await caches.keys();
    },
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
  cacheStorage?: NavigationCacheStorage,
): Promise<void> {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return;
  }

  const { origin, fetch } = runtimeEnv;

  // Use provided cacheStorage or create default one
  const storage =
    cacheStorage ?? createDefaultNavigationCacheStorage(runtimeEnv);

  // CacheStorage may be evicted by the browser at any time. We treat it as a
  // best-effort optimization.
  if (!storage) {
    return;
  }

  try {
    const url =
      rawUrl instanceof URL
        ? new URL(rawUrl.toString())
        : new URL(rawUrl, origin);

    if (url.origin !== origin) {
      // Only cache same-origin navigations.
      return;
    }

    // Ensure we are fetching the RSC navigation response.
    url.searchParams.set("__rsc", "");

    const request = new Request(url.toString(), {
      method: "GET",
      redirect: "manual",
      headers: {
        "x-prefetch": "true",
      },
    });

    const cacheName = getCurrentCacheName();
    const cache = await storage.open(cacheName);
    const response = await fetch(request);

    // Avoid caching obvious error responses; browsers may still evict entries
    // at any time, see MDN Cache docs for details.
    if (response.status >= 400) {
      return;
    }

    await cache.put(request, response.clone());
  } catch (error) {
    // Best-effort optimization; never let cache failures break navigation.
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
  cacheStorage?: NavigationCacheStorage,
): Promise<Response | undefined> {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return undefined;
  }

  const { origin } = runtimeEnv;

  // Use provided cacheStorage, check global, or create default one
  let storage = cacheStorage;
  if (!storage && typeof globalThis !== "undefined") {
    storage = (globalThis as any).__rsc_cacheStorage;
  }
  storage = storage ?? createDefaultNavigationCacheStorage(runtimeEnv);

  if (!storage) {
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
    const cache = await storage.open(cacheName);
    const cachedResponse = await cache.match(request);

    return cachedResponse ?? undefined;
  } catch (error) {
    // Best-effort optimization; never let cache failures break navigation.
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
  cacheStorage?: NavigationCacheStorage,
): Promise<void> {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();

  if (!runtimeEnv) {
    return;
  }

  // Use provided cacheStorage or create default one
  const storage =
    cacheStorage ?? createDefaultNavigationCacheStorage(runtimeEnv);

  if (!storage) {
    return;
  }

  const currentGeneration = getCurrentGeneration();
  const tabId = getTabId();
  const buildId = getBuildId();

  // Schedule cleanup in idle time to avoid blocking navigation
  const cleanup = async () => {
    try {
      // List all cache names
      const cacheNames = await storage.keys();
      const prefix = `rsc-x-prefetch:${buildId}:${tabId}:`;

      // Find all caches for this tab
      const tabCaches = cacheNames.filter((name) => name.startsWith(prefix));

      // Delete caches with generation numbers less than current
      const deletePromises = tabCaches.map((cacheName) => {
        const match = cacheName.match(new RegExp(`${prefix}(\\d+)$`));
        if (match) {
          const generation = parseInt(match[1]!, 10);
          if (generation < currentGeneration) {
            return storage.delete(cacheName);
          }
        }
        return Promise.resolve(false);
      });

      await Promise.all(deletePromises);
    } catch (error) {
      // Best-effort cleanup; never let failures break navigation.
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
export function onNavigationCommit(
  env?: NavigationCacheEnvironment,
  cacheStorage?: NavigationCacheStorage,
): void {
  const runtimeEnv = env ?? getBrowserNavigationCacheEnvironment();
  const storage =
    cacheStorage ?? createDefaultNavigationCacheStorage(runtimeEnv);

  if (!storage) {
    return;
  }

  incrementGeneration();
  void evictOldGenerationCaches(env, storage);
}

/**
 * Scan the document for `<link rel="x-prefetch" href="...">` elements that point
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
  cacheStorage?: NavigationCacheStorage,
): Promise<void> {
  if (typeof doc === "undefined") {
    return;
  }

  const links = Array.from(
    doc.querySelectorAll<HTMLLinkElement>('link[rel="x-prefetch"][href]'),
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
        return preloadNavigationUrl(url, env, cacheStorage);
      } catch {
        return;
      }
    }),
  );
}
