import { isValidElementType } from "react-is";

export type HandlerOptions<TContext = Record<string, any>> = {
  request: Request;
  env: Env;
  ctx: TContext;
  headers: Headers;
  rw: RwContext<TContext>;
};

export type RouteOptions<TContext = Record<string, any>, TParams = any> = {
  request: Request;
  params: TParams;
  env: Env;
  ctx: TContext;
  headers: Headers;
  rw: RwContext<TContext>;
};

export type PageProps<TContext> = Omit<
  RouteOptions<TContext>,
  "request" | "headers" | "rw"
> & { rw: { nonce: string } };

export type LayoutProps<TContext> = PageProps<TContext> & {
  children: React.ReactNode;
};

export type RenderPageParams<TContext> = {
  Page: React.FC<Record<string, any>>;
  props: PageProps<TContext>;
  actionResult: unknown;
  Layout: React.FC<LayoutProps<TContext>>;
};

export type RenderPage<TContext> = (
  params: RenderPageParams<TContext>,
) => Promise<Response>;

export type RwContext<TContext> = {
  nonce: string;
  Layout: React.FC<LayoutProps<TContext>>;
  renderPage: RenderPage<TContext>;
  handleAction: (ctx: RouteOptions<TContext>) => Promise<unknown>;
};

export type RouteMiddleware<TContext = any> = (
  ctx: RouteOptions<TContext>,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<void>
  | Promise<Response | void>;
type RouteFunction<TContext, TParams> = (
  ctx: RouteOptions<TContext, TParams>,
) => Response | Promise<Response>;
type RouteComponent<TContext, TParams> = (
  ctx: RouteOptions<TContext, TParams>,
) => JSX.Element | Promise<JSX.Element>;

type RouteHandler<TContext, TParams> =
  | RouteFunction<TContext, TParams>
  | RouteComponent<TContext, TParams>
  | [
      ...RouteMiddleware<TContext>[],
      RouteFunction<TContext, TParams> | RouteComponent<TContext, TParams>,
    ];

export type Route<TContext> =
  | RouteMiddleware<TContext>
  | RouteDefinition<TContext>
  | Array<Route<TContext>>;

export type RouteDefinition<TContext = Record<string, any>, TParams = any> = {
  path: string;
  handler: RouteHandler<TContext, TParams>;
};

type RouteMatch<TContext = Record<string, any>, TParams = any> = {
  params: TParams;
  handler: RouteHandler<TContext, TParams>;
};

function matchPath(
  routePath: string,
  requestPath: string,
): RouteOptions["params"] | null {
  const pattern = routePath
    .replace(/:[a-zA-Z]+/g, "([^/]+)") // Convert :param to capture group
    .replace(/\*/g, "(.*)"); // Convert * to wildcard capture group

  const regex = new RegExp(`^${pattern}$`);
  const matches = requestPath.match(regex);

  if (!matches) {
    return null;
  }

  // Extract named parameters and wildcards
  const params: RouteOptions["params"] = {};
  const paramNames = [...routePath.matchAll(/:[a-zA-Z]+/g)].map((m) =>
    m[0].slice(1),
  );
  const wildcardCount = (routePath.match(/\*/g) || []).length;

  // Add named parameters
  paramNames.forEach((name, i) => {
    params[name] = matches[i + 1];
  });

  // Add wildcard parameters with numeric indices
  for (let i = 0; i < wildcardCount; i++) {
    const wildcardIndex = paramNames.length + i + 1;
    params[`$${i}`] = matches[wildcardIndex];
  }

  return params;
}

function flattenRoutes<TContext>(
  routes: Route<TContext>[],
): (RouteMiddleware<TContext> | RouteDefinition<TContext>)[] {
  return routes.reduce((acc: Route<TContext>[], route) => {
    if (Array.isArray(route)) {
      return [...acc, ...flattenRoutes(route)];
    }
    return [...acc, route];
  }, []) as (RouteMiddleware<TContext> | RouteDefinition<TContext>)[];
}

export function defineRoutes<TContext = Record<string, any>>(
  routes: Route<TContext>[],
): {
  routes: Route<TContext>[];
  handle: ({
    request,
    ctx,
    env,
    rw,
    headers,
  }: {
    request: Request;
    ctx: TContext;
    env: Env;
    rw: RwContext<TContext>;
    headers: Headers;
  }) => Response | Promise<Response>;
} {
  const flattenedRoutes = flattenRoutes(routes);
  return {
    routes: flattenedRoutes,
    async handle({ request, ctx, env, rw, headers }) {
      const url = new URL(request.url);
      let path = url.pathname;

      // Must end with a trailing slash.
      if (path !== "/" && !path.endsWith("/")) {
        path = path + "/";
      }

      // Find matching route
      let match: RouteMatch<TContext> | null = null;
      const routeOptions: RouteOptions<TContext> = {
        request,
        params: {},
        ctx,
        env,
        rw,
        headers,
      };

      for (const route of flattenedRoutes) {
        if (typeof route === "function") {
          const r = await route(routeOptions);

          if (r instanceof Response) {
            return r;
          }

          continue;
        }

        const params = matchPath(route.path, path);
        if (params) {
          match = { params, handler: route.handler };
          break;
        }
      }

      if (!match) {
        // todo(peterp, 2025-01-28): Allow the user to define their own "not found" route.
        return new Response("Not Found", { status: 404 });
      }

      let { params, handler } = match;
      routeOptions.params = params;

      const handlers = Array.isArray(handler) ? handler : [handler];
      for (const h of handlers) {
        if (isRouteComponent(h)) {
          const actionResult = await rw.handleAction(routeOptions);
          const props = {
            params,
            env,
            ctx,
            rw: { nonce: rw.nonce },
          };
          return await rw.renderPage({
            Page: h as React.FC<Record<string, any>>,
            props,
            actionResult,
            Layout: rw.Layout,
          });
        } else {
          const r = await (h(routeOptions) as Promise<Response>);
          if (r instanceof Response) {
            return r;
          }
        }
      }

      // Add fallback return
      return new Response("Response not returned from route handler", {
        status: 500,
      });
    },
  };
}

export function route<TContext, TParams>(
  path: string,
  handler: RouteHandler<TContext, TParams>,
): RouteDefinition<TContext, TParams> {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index<TContext, TParams>(
  handler: RouteHandler<TContext, TParams>,
): RouteDefinition<TContext, TParams> {
  return route("/", handler);
}

export function prefix<TContext, TParams>(
  prefix: string,
  routes: ReturnType<typeof route<TContext, TParams>>[],
): RouteDefinition<TContext, TParams>[] {
  return routes.map((r) => {
    return {
      path: prefix + r.path,
      handler: r.handler,
    };
  });
}

export function layout<TContext = any>(
  Layout: React.FC<{ children: React.ReactNode }>,
  routes: Route<TContext>[],
): Route<TContext>[] {
  const layoutMiddleware: RouteMiddleware<TContext> = ({ rw }) => {
    rw.Layout = Layout;
  };

  return [layoutMiddleware, ...routes];
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
