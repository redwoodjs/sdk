import { describe, expect, it, vi } from "vitest";

import {
  preloadFromLinkTags,
  preloadNavigationUrl,
  type NavigationCacheEnvironment,
} from "./navigationCache";

describe("navigationCache", () => {
  describe("preloadNavigationUrl", () => {
    it("adds __rsc to the URL and writes a successful response to the cache", async () => {
      const put = vi.fn<[(Request, Response)], Promise<void>>().mockResolvedValue();
      const open = vi.fn<[string], Promise<{ put: typeof put }>>().mockResolvedValue({
        put,
      });

      const fetch = vi
        .fn<[Request], Promise<Response>>()
        .mockImplementation(async (req: Request) => {
          // The request URL should have the __rsc search param set.
          const url = new URL(req.url);
          expect(url.searchParams.has("__rsc")).toBe(true);
          return {
            status: 200,
            clone() {
              return this as Response;
            },
          } as Response;
        });

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: {
          open,
        } as unknown as CacheStorage,
        fetch: fetch as unknown as typeof globalThis.fetch,
      };

      await preloadNavigationUrl("/about", env);

      expect(open).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(put).toHaveBeenCalledTimes(1);

      const [request] = fetch.mock.calls[0];
      const url = new URL(request.url);
      expect(url.origin).toBe(env.origin);
      expect(url.pathname).toBe("/about");
      expect(url.searchParams.has("__rsc")).toBe(true);
    });

    it("does nothing when not secure or caches is unavailable", async () => {
      const fetch = vi.fn();
      const env: NavigationCacheEnvironment = {
        isSecureContext: false,
        origin: "https://example.com",
        caches: undefined,
        fetch: fetch as unknown as typeof globalThis.fetch,
      };

      await preloadNavigationUrl("/about", env);

      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("preloadFromLinkTags", () => {
    it("preloads RSC navigation for link[rel=preload] hrefs that look like routes", async () => {
      const calls: string[] = [];

      const env: NavigationCacheEnvironment = {
        isSecureContext: true,
        origin: "https://example.com",
        caches: {
          open: vi.fn().mockResolvedValue({
            put: vi.fn(),
          }),
        } as unknown as CacheStorage,
        fetch: (async (req: Request) => {
          calls.push(req.url);
          return {
            status: 200,
            clone() {
              return this as Response;
            },
          } as Response;
        }) as unknown as typeof globalThis.fetch,
      };

      const routeLink = {
        getAttribute: (name: string) => (name === "href" ? "/about" : null),
      } as unknown as HTMLLinkElement;

      const assetLink = {
        getAttribute: (name: string) => (name === "href" ? "/static/app.css" : null),
      } as unknown as HTMLLinkElement;

      const doc = {
        querySelectorAll: () =>
          [routeLink, assetLink] as unknown as NodeListOf<HTMLLinkElement>,
      } as unknown as Document;

      await preloadFromLinkTags(doc, env);

      // Only the route-like href should have been fetched.
      expect(calls.length).toBe(1);
      const url = new URL(calls[0]);
      expect(url.pathname).toBe("/about");
      expect(url.searchParams.has("__rsc")).toBe(true);
    });
  });
}


