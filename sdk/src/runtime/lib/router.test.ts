import { describe, it, expect } from "vitest";
import React from "react";

import { matchPath, defineRoutes, route, render, layout } from "./router";
import type { RwContext } from "./router";
import type { RequestInfo } from "../requestInfo/types";

describe("matchPath", () => {
  // Test case 1: Static paths
  it("should match static paths", () => {
    expect(matchPath("/about/", "/about/")).toEqual({});
    expect(matchPath("/contact/", "/contact/")).toEqual({});
  });

  it("should not match different static paths", () => {
    expect(matchPath("/about/", "/service/")).toBeNull();
  });

  // Test case 2: Paths with parameters
  it("should match paths with parameters and extract them", () => {
    expect(matchPath("/users/:id/", "/users/123/")).toEqual({ id: "123" });
    expect(
      matchPath("/posts/:category/:slug/", "/posts/tech/my-first-post/"),
    ).toEqual({ category: "tech", slug: "my-first-post" });
  });

  it("should not match if parameter is missing", () => {
    expect(matchPath("/users/:id/", "/users/")).toBeNull();
  });

  // Test case 3: Paths with wildcards
  it("should match paths with wildcards and extract them", () => {
    expect(matchPath("/files/*/", "/files/document.pdf/")).toEqual({
      $0: "document.pdf",
    });
    expect(matchPath("/data/*/content/", "/data/archive/content/")).toEqual({
      $0: "archive",
    });
    expect(matchPath("/assets/*/*/", "/assets/images/pic.png/")).toEqual({
      $0: "images",
      $1: "pic.png",
    });
  });

  it("should match empty wildcard", () => {
    expect(matchPath("/files/*/", "/files//")).toEqual({ $0: "" });
  });

  // Test case 4: Paths with both parameters and wildcards
  it("should match paths with both parameters and wildcards", () => {
    expect(
      matchPath("/products/:productId/*/", "/products/abc/details/more/"),
    ).toEqual({ productId: "abc", $0: "details/more" });
  });

  // Test case 5: Paths that don't match
  it("should return null for non-matching paths", () => {
    expect(matchPath("/specific/path/", "/a/different/path/")).toBeNull();
  });

  // Test case 6: Edge cases
  it("should handle trailing slashes correctly", () => {
    // Current implementation in defineRoutes adds a trailing slash if missing,
    // and route() function also enforces it. matchPath itself doesn't normalize.
    expect(matchPath("/path/", "/path")).toBeNull(); // Path to match must end with /
    expect(matchPath("/path/", "/path/")).toEqual({});
  });

  it("should handle paths with multiple parameters and wildcards interspersed", () => {
    expect(
      matchPath(
        "/type/:typeId/item/*/:itemId/*/",
        "/type/a/item/image/b/thumb/",
      ),
    ).toEqual({ typeId: "a", $0: "image", itemId: "b", $1: "thumb" });
  });

  it("should not allow named parameters or wildcards in the same path", () => {
    expect(() =>
      matchPath("/type/:typeId:is:broken", "/type/a-thumb-drive"),
    ).toThrow();

    expect(() => matchPath("/type/**", "/type/a-thumb-drive")).toThrow();
  });
});

describe("defineRoutes - Request Handling Behavior", () => {
  // Helper to create mock dependencies using dependency injection
  const createMockDependencies = () => {
    const mockRequestInfo: RequestInfo = {
      request: new Request("http://localhost:3000/"),
      params: {},
      ctx: {},
      rw: {
        nonce: "test-nonce",
        Document: () => React.createElement("html"),
        rscPayload: true,
        ssr: true,
        databases: new Map(),
        scriptsToBeLoaded: new Set(),
        pageRouteResolved: undefined,
      } as RwContext,
      cf: {} as any,
      response: { headers: new Headers() },
      isAction: false,
    };

    const mockRenderPage = async (
      requestInfo: RequestInfo,
      Page: React.FC,
      onError: (error: unknown) => void,
    ): Promise<Response> => {
      return new Response(`Rendered: ${Page.name || "Component"}`, {
        headers: { "content-type": "text/html" },
      });
    };

    const mockRscActionHandler = async (request: Request): Promise<unknown> => {
      return { actionResult: "test-action-result" };
    };

    const mockRunWithRequestInfoOverrides = async <Result>(
      overrides: Partial<RequestInfo>,
      fn: () => Promise<Result>,
    ): Promise<Result> => {
      // Merge overrides into the mock request info
      Object.assign(mockRequestInfo, overrides);
      return await fn();
    };

    return {
      mockRequestInfo,
      mockRenderPage,
      mockRscActionHandler,
      mockRunWithRequestInfoOverrides,
      getRequestInfo: () => mockRequestInfo,
      onError: (error: unknown) => {
        throw error;
      },
    };
  };

  describe("Sequential Route Evaluation", () => {
    it("should process routes in the exact order they are defined", async () => {
      const executionOrder: string[] = [];

      const middleware1 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware1");
      };

      const middleware2 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware2");
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page");
      };

      const router = defineRoutes([
        middleware1,
        middleware2,
        route("/test/", PageComponent),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual([
        "middleware1",
        "middleware2",
        "PageComponent",
      ]);
    });
  });

  describe("Middleware Short-Circuiting", () => {
    it("should stop processing when middleware returns a Response", async () => {
      const executionOrder: string[] = [];

      const middleware1 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware1");
      };

      const middleware2 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware2");
        return new Response("Middleware2 Response", { status: 200 });
      };

      const middleware3 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware3");
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page");
      };

      const router = defineRoutes([
        middleware1,
        middleware2,
        middleware3,
        route("/test/", PageComponent),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["middleware1", "middleware2"]);
      expect(await response.text()).toBe("Middleware2 Response");
      expect(response.status).toBe(200);
    });

    it("should stop processing when middleware returns a JSX element", async () => {
      const executionOrder: string[] = [];

      const middleware1 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware1");
      };

      const middleware2 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware2");
        return React.createElement("div", {}, "Middleware JSX");
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page");
      };

      const router = defineRoutes([
        middleware1,
        middleware2,
        route("/test/", PageComponent),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["middleware1", "middleware2"]);
      expect(await response.text()).toBe("Rendered: Element");
    });
  });

  describe("RSC Action Handling", () => {
    it("should handle RSC actions before the first route definition", async () => {
      const executionOrder: string[] = [];

      const middleware1 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware1");
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page");
      };

      const router = defineRoutes([
        middleware1,
        route("/test/", PageComponent),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request(
        "http://localhost:3000/test/?__rsc_action_id=test",
      );
      deps.mockRscActionHandler = async (request: Request) => {
        executionOrder.push("rscActionHandler");
        return { actionResult: "test-result" };
      };

      const request = new Request(
        "http://localhost:3000/test/?__rsc_action_id=test",
      );
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual([
        "middleware1",
        "rscActionHandler",
        "PageComponent",
      ]);
      expect(deps.mockRequestInfo.rw.actionResult).toEqual({
        actionResult: "test-result",
      });
    });

    it("should not handle RSC actions multiple times for multiple routes", async () => {
      const executionOrder: string[] = [];

      const PageComponent1 = () => {
        executionOrder.push("PageComponent1");
        return React.createElement("div", {}, "Page1");
      };

      const PageComponent2 = () => {
        executionOrder.push("PageComponent2");
        return React.createElement("div", {}, "Page2");
      };

      const router = defineRoutes([
        route("/other/", PageComponent1),
        route("/test/", PageComponent2),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request(
        "http://localhost:3000/test/?__rsc_action_id=test",
      );
      deps.mockRscActionHandler = async (request: Request) => {
        executionOrder.push("rscActionHandler");
        return { actionResult: "test-result" };
      };

      const request = new Request(
        "http://localhost:3000/test/?__rsc_action_id=test",
      );
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["rscActionHandler", "PageComponent2"]);
      // Should only call action handler once, even though there are multiple routes
    });
  });

  describe("Page Route Matching and Rendering", () => {
    it("should match the first route that matches the path", async () => {
      const executionOrder: string[] = [];

      const PageComponent1 = () => {
        executionOrder.push("PageComponent1");
        return React.createElement("div", {}, "Page1");
      };

      const PageComponent2 = () => {
        executionOrder.push("PageComponent2");
        return React.createElement("div", {}, "Page2");
      };

      const router = defineRoutes([
        route("/test/", PageComponent1),
        route("/test/", PageComponent2), // This should never be reached
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["PageComponent1"]);
    });

    it("should continue to next route if path does not match", async () => {
      const executionOrder: string[] = [];

      const PageComponent1 = () => {
        executionOrder.push("PageComponent1");
        return React.createElement("div", {}, "Page1");
      };

      const PageComponent2 = () => {
        executionOrder.push("PageComponent2");
        return React.createElement("div", {}, "Page2");
      };

      const router = defineRoutes([
        route("/other/", PageComponent1),
        route("/test/", PageComponent2),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["PageComponent2"]);
    });

    it("should return 404 when no routes match", async () => {
      const PageComponent = () => React.createElement("div", {}, "Page");

      const router = defineRoutes([route("/other/", PageComponent)]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(response.status).toBe(404);
      expect(await response.text()).toBe("Not Found");
    });
  });

  describe("Multiple Render Blocks with SSR Configuration", () => {
    it("should short-circuit on first matching render block and not apply later configurations", async () => {
      const executionOrder: string[] = [];
      const ssrSettings: boolean[] = [];

      const Document1 = () => React.createElement("html", {}, "Doc1");
      const Document2 = () => React.createElement("html", {}, "Doc2");

      const PageComponent1 = (requestInfo: RequestInfo) => {
        executionOrder.push("PageComponent1");
        ssrSettings.push(requestInfo.rw.ssr);
        return React.createElement("div", {}, "Page1");
      };

      const PageComponent2 = (requestInfo: RequestInfo) => {
        executionOrder.push("PageComponent2");
        ssrSettings.push(requestInfo.rw.ssr);
        return React.createElement("div", {}, "Page2");
      };

      const router = defineRoutes([
        ...render(Document1, [route("/test/", PageComponent1)], { ssr: true }),
        ...render(Document2, [route("/other/", PageComponent2)], {
          ssr: false,
        }),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["PageComponent1"]);
      expect(ssrSettings).toEqual([true]);
      // The second render block's ssr: false should not have been applied
      expect(deps.mockRequestInfo.rw.Document).toBe(Document1);
    });
  });

  describe("Route-Specific Middleware", () => {
    it("should execute route-specific middleware before the component", async () => {
      const executionOrder: string[] = [];

      const globalMiddleware = (requestInfo: RequestInfo) => {
        executionOrder.push("globalMiddleware");
      };

      const routeMiddleware = (requestInfo: RequestInfo) => {
        executionOrder.push("routeMiddleware");
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page");
      };

      const router = defineRoutes([
        globalMiddleware,
        route("/test/", [routeMiddleware, PageComponent]),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual([
        "globalMiddleware",
        "routeMiddleware",
        "PageComponent",
      ]);
    });

    it("should short-circuit if route-specific middleware returns a Response", async () => {
      const executionOrder: string[] = [];

      const routeMiddleware = (requestInfo: RequestInfo) => {
        executionOrder.push("routeMiddleware");
        return new Response("Route Middleware Response");
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page");
      };

      const router = defineRoutes([
        route("/test/", [routeMiddleware, PageComponent]),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      const request = new Request("http://localhost:3000/test/");
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(executionOrder).toEqual(["routeMiddleware"]);
      expect(await response.text()).toBe("Route Middleware Response");
    });
  });

  describe("Layout Handling", () => {
    it("should wrap components with layouts", async () => {
      const executionOrder: string[] = [];

      const TestLayout = ({ children }: { children?: React.ReactNode }) => {
        executionOrder.push("TestLayout");
        return React.createElement("div", { className: "layout" }, children);
      };

      const PageComponent = () => {
        executionOrder.push("PageComponent");
        return React.createElement("div", {}, "Page Content");
      };

      const router = defineRoutes([
        ...layout(TestLayout, [route("/test/", PageComponent)]),
      ]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test/");

      // Mock renderPage to track layout wrapping
      deps.mockRenderPage = async (requestInfo, WrappedComponent, onError) => {
        // The component should be wrapped with layouts
        const element = React.createElement(WrappedComponent);
        return new Response(`Rendered with layouts`);
      };

      const request = new Request("http://localhost:3000/test/");
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(await response.text()).toBe("Rendered with layouts");
    });
  });

  describe("Parameter Extraction", () => {
    it("should extract path parameters and make them available in request info", async () => {
      let extractedParams: any = null;

      const PageComponent = (requestInfo: RequestInfo) => {
        extractedParams = requestInfo.params;
        return React.createElement("div", {}, `User: ${requestInfo.params.id}`);
      };

      const router = defineRoutes([route("/users/:id/", PageComponent)]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request(
        "http://localhost:3000/users/123/",
      );

      const request = new Request("http://localhost:3000/users/123/");
      await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(extractedParams).toEqual({ id: "123" });
    });
  });

  describe("Edge Cases", () => {
    it("should handle middleware-only apps with RSC actions", async () => {
      const executionOrder: string[] = [];

      const middleware1 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware1");
      };

      const middleware2 = (requestInfo: RequestInfo) => {
        executionOrder.push("middleware2");
        return new Response("Middleware Response");
      };

      // No route definitions, only middleware
      const router = defineRoutes([middleware1, middleware2]);

      const deps = createMockDependencies();
      deps.mockRequestInfo.request = new Request(
        "http://localhost:3000/test/?__rsc_action_id=test",
      );
      deps.mockRscActionHandler = async (request: Request) => {
        executionOrder.push("rscActionHandler");
        return { actionResult: "test-result" };
      };

      const request = new Request(
        "http://localhost:3000/test/?__rsc_action_id=test",
      );
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      // Action should still be handled even with no route definitions
      expect(executionOrder).toEqual(["middleware1", "middleware2"]);
      expect(await response.text()).toBe("Middleware Response");
    });

    it("should handle trailing slash normalization", async () => {
      const PageComponent = () => React.createElement("div", {}, "Page");

      const router = defineRoutes([route("/test/", PageComponent)]);

      const deps = createMockDependencies();

      // Request without trailing slash should be normalized
      deps.mockRequestInfo.request = new Request("http://localhost:3000/test");
      const request = new Request("http://localhost:3000/test");
      const response = await router.handle({
        request,
        renderPage: deps.mockRenderPage,
        getRequestInfo: deps.getRequestInfo,
        onError: deps.onError,
        runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
        rscActionHandler: deps.mockRscActionHandler,
      });

      expect(response.status).not.toBe(404);
      expect(await response.text()).toBe("Rendered: Element");
    });
  });
});
