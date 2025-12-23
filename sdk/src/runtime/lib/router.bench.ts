import React from "react";
import { bench } from "vitest";

import type { RequestInfo } from "../requestInfo/types";
import {
  defineRoutes,
  layout,
  matchPath,
  prefix,
  route,
} from "./router";
import type { RwContext } from "./types.js";

// Helper to create mock dependencies
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
      entryScripts: new Set(),
      inlineScripts: new Set(),
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

// Simple page component for testing
const PageComponent = () => React.createElement("div", {}, "Page");

// Benchmark: matchPath - Static routes
bench("matchPath - static route", () => {
  matchPath("/about/", "/about/");
}, { time: 1000 });

bench("matchPath - static route (non-match)", () => {
  matchPath("/about/", "/contact/");
}, { time: 1000 });

// Benchmark: matchPath - Parameterized routes
bench("matchPath - single parameter", () => {
  matchPath("/users/:id/", "/users/123/");
}, { time: 1000 });

bench("matchPath - multiple parameters", () => {
  matchPath("/posts/:category/:slug/", "/posts/tech/my-first-post/");
}, { time: 1000 });

bench("matchPath - complex parameters", () => {
  matchPath(
    "/type/:typeId/item/*/:itemId/*/",
    "/type/a/item/image/b/thumb/",
  );
}, { time: 1000 });

// Benchmark: matchPath - Wildcard routes
bench("matchPath - single wildcard", () => {
  matchPath("/files/*/", "/files/document.pdf/");
}, { time: 1000 });

bench("matchPath - multiple wildcards", () => {
  matchPath("/assets/*/*/", "/assets/images/pic.png/");
}, { time: 1000 });

// Benchmark: matchPath - Mixed patterns
bench("matchPath - parameters and wildcards", () => {
  matchPath("/products/:productId/*/", "/products/abc/details/more/");
}, { time: 1000 });

// Benchmark: Router - Single route matching (best case)
bench("router.handle - single route (first match)", async () => {
  const router = defineRoutes([
    route("/test/", PageComponent),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Matching at end of long list (worst case)
bench("router.handle - match at end of 100 routes", async () => {
  const routes = Array.from({ length: 100 }, (_, i) =>
    route(`/route-${i}/`, PageComponent)
  );
  routes.push(route("/target/", PageComponent));

  const router = defineRoutes(routes);
  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/target/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Non-matching path (worst case)
bench("router.handle - non-match through 100 routes", async () => {
  const routes = Array.from({ length: 100 }, (_, i) =>
    route(`/route-${i}/`, PageComponent)
  );

  const router = defineRoutes(routes);
  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/nonexistent/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Large-scale router (100+ routes)
bench("router.handle - large router (200 routes)", async () => {
  const routes = Array.from({ length: 200 }, (_, i) =>
    route(`/route-${i}/`, PageComponent)
  );
  // Add a target route in the middle
  routes.splice(100, 0, route("/target/", PageComponent));

  const router = defineRoutes(routes);
  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/target/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Deeply nested routes (5+ levels)
bench("router.handle - deeply nested routes (5 levels)", async () => {
  const router = defineRoutes([
    prefix("/level1", [
      prefix("/level2", [
        prefix("/level3", [
          prefix("/level4", [
            prefix("/level5", [
              route("/target/", PageComponent),
            ]),
          ]),
        ]),
      ]),
    ]),
  ]);

  const deps = createMockDependencies();
  const request = new Request(
    "http://localhost:3000/level1/level2/level3/level4/level5/target/",
  );

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - deeply nested routes (10 levels)", async () => {
  let routes: any[] = [route("/target/", PageComponent)];
  for (let i = 10; i >= 1; i--) {
    routes = prefix(`/level${i}`, routes);
  }

  const router = defineRoutes(routes);
  const deps = createMockDependencies();
  const request = new Request(
    "http://localhost:3000/level1/level2/level3/level4/level5/level6/level7/level8/level9/level10/target/",
  );

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Multiple layouts
const Layout1 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout1" }, children);
const Layout2 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout2" }, children);
const Layout3 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout3" }, children);

bench("router.handle - single layout", async () => {
  const router = defineRoutes([
    layout(Layout1, [route("/test/", PageComponent)]),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - multiple layouts (3)", async () => {
  const router = defineRoutes([
    layout(Layout1, [
      layout(Layout2, [
        layout(Layout3, [route("/test/", PageComponent)]),
      ]),
    ]),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - multiple layouts (5)", async () => {
  const Layout4 = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { className: "layout4" }, children);
  const Layout5 = ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { className: "layout5" }, children);

  const router = defineRoutes([
    layout(Layout1, [
      layout(Layout2, [
        layout(Layout3, [
          layout(Layout4, [
            layout(Layout5, [route("/test/", PageComponent)]),
          ]),
        ]),
      ]),
    ]),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Middleware overhead
const noopMiddleware = () => {};

bench("router.handle - no middleware", async () => {
  const router = defineRoutes([route("/test/", PageComponent)]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - 1 global middleware", async () => {
  const router = defineRoutes([
    noopMiddleware,
    route("/test/", PageComponent),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - 10 global middlewares", async () => {
  const middlewares = Array.from({ length: 10 }, () => noopMiddleware);
  const router = defineRoutes([
    ...middlewares,
    route("/test/", PageComponent),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - 1 route-specific middleware", async () => {
  const router = defineRoutes([
    route("/test/", [noopMiddleware, PageComponent]),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

bench("router.handle - 5 route-specific middlewares", async () => {
  const middlewares = Array.from({ length: 5 }, () => noopMiddleware);
  const router = defineRoutes([
    route("/test/", [...middlewares, PageComponent]),
  ]);

  const deps = createMockDependencies();
  const request = new Request("http://localhost:3000/test/");

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Complex real-world scenario
bench("router.handle - complex scenario (nested + layouts + middleware)", async () => {
  const authMiddleware = () => {};
  const adminMiddleware = () => {};

  const router = defineRoutes([
    authMiddleware,
    prefix("/admin", [
      adminMiddleware,
      layout(Layout1, [
        layout(Layout2, [
          route("/dashboard/", PageComponent),
          route("/users/:id/", PageComponent),
          route("/settings/*/", PageComponent),
        ]),
      ]),
    ]),
    prefix("/api", [
      route("/users/", PageComponent),
      route("/posts/:id/", PageComponent),
    ]),
    route("/", PageComponent),
  ]);

  const deps = createMockDependencies();
  const request = new Request(
    "http://localhost:3000/admin/dashboard/",
  );

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });

// Benchmark: Router - Parameter extraction performance
bench("router.handle - parameter extraction (many params)", async () => {
  const router = defineRoutes([
    route(
      "/a/:a/b/:b/c/:c/d/:d/e/:e/f/:f/g/:g/h/:h/i/:i/j/:j/",
      PageComponent,
    ),
  ]);

  const deps = createMockDependencies();
  const request = new Request(
    "http://localhost:3000/a/1/b/2/c/3/d/4/e/5/f/6/g/7/h/8/i/9/j/10/",
  );

  await router.handle({
    request,
    renderPage: deps.mockRenderPage,
    getRequestInfo: deps.getRequestInfo,
    onError: deps.onError,
    runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
    rscActionHandler: deps.mockRscActionHandler,
  });
}, { time: 1000 });
