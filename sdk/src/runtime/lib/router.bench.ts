import React from "react";
import { bench } from "vitest";

import type { RequestInfo } from "../requestInfo/types";
import { defineRoutes, layout, matchPath, prefix, route } from "./router";
import type { RwContext } from "./types.js";

// Helper to create mock dependencies
const createMockDependencies = (url = "http://localhost:3000/") => {
  const parsedUrl = new URL(url);
  let path = parsedUrl.pathname;
  if (path !== "/" && !path.endsWith("/")) {
    path = path + "/";
  }

  const mockRequestInfo: RequestInfo = {
    request: new Request(url),
    path,
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
    isAction: parsedUrl.searchParams.has("__rsc_action_id"),
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
bench(
  "matchPath - static route",
  () => {
    matchPath("/about/", "/about/");
  },
  { time: 1000 },
);

bench(
  "matchPath - static route (non-match)",
  () => {
    matchPath("/about/", "/contact/");
  },
  { time: 1000 },
);

// Benchmark: matchPath - Parameterized routes
bench(
  "matchPath - single parameter",
  () => {
    matchPath("/users/:id/", "/users/123/");
  },
  { time: 1000 },
);

bench(
  "matchPath - multiple parameters",
  () => {
    matchPath("/posts/:category/:slug/", "/posts/tech/my-first-post/");
  },
  { time: 1000 },
);

bench(
  "matchPath - complex parameters",
  () => {
    matchPath("/type/:typeId/item/*/:itemId/*/", "/type/a/item/image/b/thumb/");
  },
  { time: 1000 },
);

// Benchmark: matchPath - Wildcard routes
bench(
  "matchPath - single wildcard",
  () => {
    matchPath("/files/*/", "/files/document.pdf/");
  },
  { time: 1000 },
);

bench(
  "matchPath - multiple wildcards",
  () => {
    matchPath("/assets/*/*/", "/assets/images/pic.png/");
  },
  { time: 1000 },
);

// Benchmark: matchPath - Mixed patterns
bench(
  "matchPath - parameters and wildcards",
  () => {
    matchPath("/products/:productId/*/", "/products/abc/details/more/");
  },
  { time: 1000 },
);

// Benchmark: Router - Single route matching (best case)
const singleRouteRouter = defineRoutes([route("/test/", PageComponent)]);

bench(
  "router.handle - single route (first match)",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await singleRouteRouter.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Matching at end of long list (worst case)
const routes100 = Array.from({ length: 100 }, (_, i) =>
  route(`/route-${i}/`, PageComponent),
);
routes100.push(route("/target/", PageComponent));
const router100MatchAtEnd = defineRoutes(routes100);

bench(
  "router.handle - match at end of 100 routes",
  async () => {
    const url = "http://localhost:3000/target/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router100MatchAtEnd.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Non-matching path (worst case)
const routes100NoMatch = Array.from({ length: 100 }, (_, i) =>
  route(`/route-${i}/`, PageComponent),
);
const router100NoMatch = defineRoutes(routes100NoMatch);

bench(
  "router.handle - non-match through 100 routes",
  async () => {
    const url = "http://localhost:3000/nonexistent/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router100NoMatch.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Large-scale router (100+ routes)
const routes200 = Array.from({ length: 200 }, (_, i) =>
  route(`/route-${i}/`, PageComponent),
);
// Add a target route in the middle
routes200.splice(100, 0, route("/target/", PageComponent));
const router200 = defineRoutes(routes200);

bench(
  "router.handle - large router (200 routes)",
  async () => {
    const url = "http://localhost:3000/target/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router200.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Deeply nested routes (5+ levels)
const router5Levels = defineRoutes([
  prefix("/level1", [
    prefix("/level2", [
      prefix("/level3", [
        prefix("/level4", [
          prefix("/level5", [route("/target/", PageComponent)]),
        ]),
      ]),
    ]),
  ]),
]);

bench(
  "router.handle - deeply nested routes (5 levels)",
  async () => {
    const url =
      "http://localhost:3000/level1/level2/level3/level4/level5/target/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router5Levels.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

let routes10Levels: any[] = [route("/target/", PageComponent)];
for (let i = 10; i >= 1; i--) {
  routes10Levels = prefix(`/level${i}`, routes10Levels);
}
const router10Levels = defineRoutes(routes10Levels);

bench(
  "router.handle - deeply nested routes (10 levels)",
  async () => {
    const url =
      "http://localhost:3000/level1/level2/level3/level4/level5/level6/level7/level8/level9/level10/target/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router10Levels.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Multiple layouts
const Layout1 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout1" }, children);
const Layout2 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout2" }, children);
const Layout3 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout3" }, children);

const router1Layout = defineRoutes([
  layout(Layout1, [route("/test/", PageComponent)]),
]);

bench(
  "router.handle - single layout",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router1Layout.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

const router3Layouts = defineRoutes([
  layout(Layout1, [
    layout(Layout2, [layout(Layout3, [route("/test/", PageComponent)])]),
  ]),
]);

bench(
  "router.handle - multiple layouts (3)",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router3Layouts.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

const Layout4 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout4" }, children);
const Layout5 = ({ children }: { children?: React.ReactNode }) =>
  React.createElement("div", { className: "layout5" }, children);

const router5Layouts = defineRoutes([
  layout(Layout1, [
    layout(Layout2, [
      layout(Layout3, [
        layout(Layout4, [layout(Layout5, [route("/test/", PageComponent)])]),
      ]),
    ]),
  ]),
]);

bench(
  "router.handle - multiple layouts (5)",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router5Layouts.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Middleware overhead
const noopMiddleware = () => {};

const routerNoMiddleware = defineRoutes([route("/test/", PageComponent)]);

bench(
  "router.handle - no middleware",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await routerNoMiddleware.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

const router1GlobalMiddleware = defineRoutes([
  noopMiddleware,
  route("/test/", PageComponent),
]);

bench(
  "router.handle - 1 global middleware",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router1GlobalMiddleware.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

const router10GlobalMiddlewares = defineRoutes([
  ...Array.from({ length: 10 }, () => noopMiddleware),
  route("/test/", PageComponent),
]);

bench(
  "router.handle - 10 global middlewares",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router10GlobalMiddlewares.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

const router1RouteMiddleware = defineRoutes([
  route("/test/", [noopMiddleware, PageComponent]),
]);

bench(
  "router.handle - 1 route-specific middleware",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router1RouteMiddleware.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

const router5RouteMiddlewares = defineRoutes([
  route("/test/", [
    ...Array.from({ length: 5 }, () => noopMiddleware),
    PageComponent,
  ]),
]);

bench(
  "router.handle - 5 route-specific middlewares",
  async () => {
    const url = "http://localhost:3000/test/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await router5RouteMiddlewares.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Complex real-world scenario
const authMiddleware = () => {};
const adminMiddleware = () => {};

const complexRouter = defineRoutes([
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

bench(
  "router.handle - complex scenario (nested + layouts + middleware)",
  async () => {
    const url = "http://localhost:3000/admin/dashboard/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await complexRouter.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);

// Benchmark: Router - Parameter extraction performance
const routerManyParams = defineRoutes([
  route("/a/:a/b/:b/c/:c/d/:d/e/:e/f/:f/g/:g/h/:h/i/:i/j/:j/", PageComponent),
]);

bench(
  "router.handle - parameter extraction (many params)",
  async () => {
    const url =
      "http://localhost:3000/a/1/b/2/c/3/d/4/e/5/f/6/g/7/h/8/i/9/j/10/";
    const deps = createMockDependencies(url);
    const request = new Request(url);

    await routerManyParams.handle({
      request,
      renderPage: deps.mockRenderPage,
      getRequestInfo: deps.getRequestInfo,
      onError: deps.onError,
      runWithRequestInfoOverrides: deps.mockRunWithRequestInfoOverrides,
      rscActionHandler: deps.mockRscActionHandler,
    });
  },
  { time: 1000 },
);
