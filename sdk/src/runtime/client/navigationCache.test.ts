import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDefaultNavigationCacheStorage,
  evictOldGenerationCaches,
  getCachedNavigationResponse,
  onNavigationCommit,
  preloadFromLinkTags,
  preloadNavigationUrl,
  type NavigationCache,
  type NavigationCacheEnvironment,
  type NavigationCacheStorage,
} from "./navigationCache";

describe("navigationCache", () => {
  let mockCacheStorage: CacheStorage;
  let mockCache: Cache;
  let mockFetch: typeof fetch;
  let mockSessionStorage: Storage;
  // Local type for requestIdleCallback to avoid depending on global declarations
  let mockRequestIdleCallback: (callback: () => void) => number;

  beforeEach(() => {
    // Reset module state between tests
    vi.resetModules();

    // Mock Cache
    mockCache = {
      put: vi.fn().mockResolvedValue(undefined),
      match: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(true),
      add: vi.fn(),
      addAll: vi.fn(),
      keys: vi.fn(),
      matchAll: vi.fn(),
    } as unknown as Cache;

    // Mock CacheStorage
    mockCacheStorage = {
      open: vi.fn().mockResolvedValue(mockCache),
      delete: vi.fn().mockResolvedValue(true),
      keys: vi.fn().mockResolvedValue([]),
      has: vi.fn(),
      match: vi.fn(),
    } as unknown as CacheStorage;

    // Mock fetch
    mockFetch = vi.fn().mockResolvedValue(
      new Response("test response", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );

    // Mock sessionStorage
    mockSessionStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    // Mock requestIdleCallback to execute callback asynchronously for testing
    let idleCallback: (() => void) | null = null;
    mockRequestIdleCallback = vi.fn((callback: () => void) => {
      idleCallback = callback;
      // Execute after current I/O callbacks
      setImmediate(() => {
        if (idleCallback) {
          idleCallback();
          idleCallback = null;
        }
      });
      return 1;
    });

    // Setup global mocks
    (globalThis as any).window = {
      isSecureContext: true,
      location: { origin: "https://example.com" },
      caches: mockCacheStorage,
      fetch: mockFetch,
      sessionStorage: mockSessionStorage,
      crypto: {
        randomUUID: () => "test-uuid-123",
      } as unknown as Crypto,
    } as unknown as Window & typeof globalThis;

    (globalThis as any).requestIdleCallback = mockRequestIdleCallback;
  });

  describe("createDefaultNavigationCacheStorage", () => {
    it("should create a cache storage wrapper", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const storage = createDefaultNavigationCacheStorage(env);
      expect(storage).toBeDefined();

      const cache = await storage!.open("test-cache");
      expect(mockCacheStorage.open).toHaveBeenCalledWith("test-cache");
      expect(cache).toBeDefined();
    });

    it("should return undefined if not secure context", () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: false,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const storage = createDefaultNavigationCacheStorage(env);
      expect(storage).toBeUndefined();
    });

    it("should return undefined if no caches available", () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: undefined,
        fetch: mockFetch,
      };

      const storage = createDefaultNavigationCacheStorage(env);
      expect(storage).toBeUndefined();
    });
  });

  describe("preloadNavigationUrl", () => {
    it("should cache a successful response", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env);

      expect(mockFetch).toHaveBeenCalled();
      expect(mockCacheStorage.open).toHaveBeenCalled();
      expect(mockCache.put).toHaveBeenCalled();
    });

    it("should not cache error responses (status >= 400)", async () => {
      const errorFetch = vi
        .fn()
        .mockResolvedValue(new Response("error", { status: 404 }));

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: errorFetch,
      };

      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env);

      expect(errorFetch).toHaveBeenCalled();
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it("should skip cross-origin URLs", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://other-origin.com/test");
      await preloadNavigationUrl(url, env);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(mockCache.put).not.toHaveBeenCalled();
    });

    it("should add __rsc query parameter", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env);

      const fetchCall = (mockFetch as any).mock.calls[0];
      const request = fetchCall[0] as Request;
      const requestUrl = new URL(request.url);
      expect(requestUrl.searchParams.has("__rsc")).toBe(true);
    });

    it("should use custom cacheStorage when provided", async () => {
      const customCache: NavigationCache = {
        put: vi.fn().mockResolvedValue(undefined),
        match: vi.fn().mockResolvedValue(undefined),
      };

      const customStorage: NavigationCacheStorage = {
        open: vi.fn().mockResolvedValue(customCache),
        delete: vi.fn().mockResolvedValue(true),
        keys: vi.fn().mockResolvedValue([]),
      };

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env, customStorage);

      expect(customStorage.open).toHaveBeenCalled();
      expect(customCache.put).toHaveBeenCalled();
      expect(mockCacheStorage.open).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      const errorFetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: errorFetch,
      };

      const url = new URL("https://example.com/test");
      // Should not throw
      await expect(preloadNavigationUrl(url, env)).resolves.toBeUndefined();
    });
  });

  describe("getCachedNavigationResponse", () => {
    it("should return cached response if found", async () => {
      const cachedResponse = new Response("cached", { status: 200 });
      (mockCache.match as any).mockResolvedValue(cachedResponse);

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      const result = await getCachedNavigationResponse(url, env);

      expect(result).toBe(cachedResponse);
      expect(mockCache.match).toHaveBeenCalled();
    });

    it("should return undefined if not cached", async () => {
      (mockCache.match as any).mockResolvedValue(undefined);

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      const result = await getCachedNavigationResponse(url, env);

      expect(result).toBeUndefined();
    });

    it("should check global cacheStorage if not provided", async () => {
      const cachedResponse = new Response("cached", { status: 200 });
      const customCache: NavigationCache = {
        put: vi.fn(),
        match: vi.fn().mockResolvedValue(cachedResponse),
      };

      const customStorage: NavigationCacheStorage = {
        open: vi.fn().mockResolvedValue(customCache),
        delete: vi.fn(),
        keys: vi.fn().mockResolvedValue([]),
      };

      // Set global cache storage
      (globalThis as any).__rsc_cacheStorage = customStorage;

      const url = new URL("https://example.com/test");
      const result = await getCachedNavigationResponse(url);

      expect(result).toBe(cachedResponse);
      expect(customStorage.open).toHaveBeenCalled();

      // Cleanup
      delete (globalThis as any).__rsc_cacheStorage;
    });

    it("should add __rsc query parameter", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      await getCachedNavigationResponse(url, env);

      const matchCall = (mockCache.match as any).mock.calls[0];
      const request = matchCall[0] as Request;
      const requestUrl = new URL(request.url);
      expect(requestUrl.searchParams.has("__rsc")).toBe(true);
    });

    it("should skip cross-origin URLs", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://other-origin.com/test");
      const result = await getCachedNavigationResponse(url, env);

      expect(result).toBeUndefined();
      expect(mockCache.match).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      (mockCache.match as any).mockRejectedValue(new Error("Cache error"));

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      // Should not throw
      const result = await getCachedNavigationResponse(url, env);
      expect(result).toBeUndefined();
    });
  });

  describe("evictOldGenerationCaches", () => {
    it("should delete old generation caches", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      // Get the actual tabId that will be used
      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env);
      const openCall = (mockCacheStorage.open as any).mock.calls[0];
      const cacheName = openCall[0] as string;
      const tabIdMatch = cacheName.match(/^rsc-prefetch:rwsdk:([^:]+):\d+$/);
      const tabId = tabIdMatch ? tabIdMatch[1] : "test-uuid-123";

      // Increment generation to 2 by calling onNavigationCommit twice
      onNavigationCommit(env);
      onNavigationCommit(env);

      // Mock cache names matching the actual tabId
      const allCacheNames = [
        `rsc-prefetch:rwsdk:${tabId}:0`,
        `rsc-prefetch:rwsdk:${tabId}:1`,
        `rsc-prefetch:rwsdk:${tabId}:2`,
        "rsc-prefetch:rwsdk:other-tab:0",
      ];
      (mockCacheStorage.keys as any).mockResolvedValue(allCacheNames);

      await evictOldGenerationCaches(env);

      // Wait for the cleanup to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should delete generations 0 and 1, but not 2 (current) or other-tab
      expect(mockCacheStorage.delete).toHaveBeenCalledWith(
        `rsc-prefetch:rwsdk:${tabId}:0`,
      );
      expect(mockCacheStorage.delete).toHaveBeenCalledWith(
        `rsc-prefetch:rwsdk:${tabId}:1`,
      );
      expect(mockCacheStorage.delete).not.toHaveBeenCalledWith(
        `rsc-prefetch:rwsdk:${tabId}:2`,
      );
      expect(mockCacheStorage.delete).not.toHaveBeenCalledWith(
        "rsc-prefetch:rwsdk:other-tab:0",
      );
    });

    it("should use custom cacheStorage when provided", async () => {
      // Get the actual tabId that will be used
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };
      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env);
      const openCall = (mockCacheStorage.open as any).mock.calls[0];
      const cacheName = openCall[0] as string;
      const tabIdMatch = cacheName.match(/^rsc-prefetch:rwsdk:([^:]+):\d+$/);
      const tabId = tabIdMatch ? tabIdMatch[1] : "test-uuid-123";

      const customStorage: NavigationCacheStorage = {
        open: vi.fn(),
        delete: vi.fn().mockResolvedValue(true),
        keys: vi
          .fn()
          .mockResolvedValue([
            `rsc-prefetch:rwsdk:${tabId}:0`,
            `rsc-prefetch:rwsdk:${tabId}:1`,
          ]),
      };

      // Increment generation so there are old caches to delete
      onNavigationCommit();

      await evictOldGenerationCaches(undefined, customStorage);

      // Wait for the cleanup to execute
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(customStorage.keys).toHaveBeenCalled();
      expect(customStorage.delete).toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      (mockCacheStorage.keys as any).mockRejectedValue(
        new Error("Cache error"),
      );

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      // Should not throw
      await expect(evictOldGenerationCaches(env)).resolves.toBeUndefined();

      // Wait for requestIdleCallback to execute
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe("onNavigationCommit", () => {
    it("should increment generation and evict old caches", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      (mockCacheStorage.keys as any).mockResolvedValue([]);

      onNavigationCommit(env);

      // Wait for eviction to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockRequestIdleCallback).toHaveBeenCalled();
    });
  });

  describe("preloadFromLinkTags", () => {
    it("should preload URLs from prefetch link tags", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      // Create a mock document with prefetch links
      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([
          {
            getAttribute: () => "/page1",
          },
          {
            getAttribute: () => "/page2",
          },
        ]),
      } as unknown as Document;

      await preloadFromLinkTags(mockDoc, env);

      // Should have called preloadNavigationUrl for each link
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should skip non-route-like hrefs (not starting with /)", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([
          {
            getAttribute: () => "https://example.com/page1",
          },
          {
            getAttribute: () => "/page2",
          },
        ]),
      } as unknown as Document;

      await preloadFromLinkTags(mockDoc, env);

      // Should only preload /page2, not the absolute URL
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should use custom cacheStorage when provided", async () => {
      const customCache: NavigationCache = {
        put: vi.fn().mockResolvedValue(undefined),
        match: vi.fn(),
      };

      const customStorage: NavigationCacheStorage = {
        open: vi.fn().mockResolvedValue(customCache),
        delete: vi.fn(),
        keys: vi.fn().mockResolvedValue([]),
      };

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const mockDoc = {
        querySelectorAll: vi.fn().mockReturnValue([
          {
            getAttribute: () => "/page1",
          },
        ]),
      } as unknown as Document;

      await preloadFromLinkTags(mockDoc, env, customStorage);

      expect(customStorage.open).toHaveBeenCalled();
      expect(customCache.put).toHaveBeenCalled();
    });
  });

  describe("cache name generation", () => {
    it("should generate cache names with correct format", async () => {
      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: mockCacheStorage,
        fetch: mockFetch,
      };

      const url = new URL("https://example.com/test");
      await preloadNavigationUrl(url, env);

      const openCall = (mockCacheStorage.open as any).mock.calls[0];
      const cacheName = openCall[0] as string;

      expect(cacheName).toMatch(/^rsc-prefetch:rwsdk:[^:]+:\d+$/);
    });
  });
});
