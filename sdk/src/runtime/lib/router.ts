import { isValidElementType } from "react-is";
import { ExecutionContext } from "@cloudflare/workers-types";

export type HandlerOptions<TAppContext = Record<string, any>> = {
  request: Request;
  env: Env;
  cf: ExecutionContext;
  appContext: TAppContext;
  headers: Headers;
  rw: RwContext<TAppContext>;
};

export type RouteOptions<TAppContext = Record<string, any>, TParams = any> = {
  cf: ExecutionContext;
  request: Request;
  params: TParams;
  env: Env;
  appContext: TAppContext;
  headers: Headers;
  rw: RwContext<TAppContext>;
};

export type PageProps<TAppContext> = Omit<
  RouteOptions<TAppContext>,
  "request" | "headers" | "rw" | "cf"
> & { rw: { nonce: string } };

export type DocumentProps<TAppContext> = PageProps<TAppContext> & {
  children: React.ReactNode;
};

export type RenderPageParams<TAppContext> = {
  Page: React.FC<Record<string, any>>;
  props: PageProps<TAppContext>;
  actionResult: unknown;
  Document: React.FC<DocumentProps<TAppContext>>;
};

export type RenderPage<TAppContext> = (
  params: RenderPageParams<TAppContext>,
) => Promise<Response>;

export type RwContext<TAppContext> = {
  nonce: string;
  Document: React.FC<DocumentProps<TAppContext>>;
  renderPage: RenderPage<TAppContext>;
  handleAction: (opts: RouteOptions<TAppContext>) => Promise<unknown>;
};

export type RouteMiddleware<TAppContext = any> = (
  opts: RouteOptions<TAppContext>,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<void>
  | Promise<Response | void>;
type RouteFunction<TAppContext, TParams> = (
  opts: RouteOptions<TAppContext, TParams>,
) => Response | Promise<Response>;
type RouteComponent<TAppContext, TParams> = (
  opts: RouteOptions<TAppContext, TParams>,
) => JSX.Element | Promise<JSX.Element>;

type RouteHandler<TAppContext, TParams> =
  | RouteFunction<TAppContext, TParams>
  | RouteComponent<TAppContext, TParams>
  | [
      ...RouteMiddleware<TAppContext>[],
      (
        | RouteFunction<TAppContext, TParams>
        | RouteComponent<TAppContext, TParams>
      ),
    ];

export type Route<TAppContext> =
  | RouteMiddleware<TAppContext>
  | RouteDefinition<TAppContext>
  | Array<Route<TAppContext>>;

export type RouteDefinition<
  TAppContext = Record<string, any>,
  TParams = any,
> = {
  path: string;
  handler: RouteHandler<TAppContext, TParams>;
};

type RouteMatch<TAppContext = Record<string, any>, TParams = any> = {
  params: TParams;
  handler: RouteHandler<TAppContext, TParams>;
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

function flattenRoutes<TAppContext>(
  routes: Route<TAppContext>[],
): (RouteMiddleware<TAppContext> | RouteDefinition<TAppContext>)[] {
  return routes.reduce((acc: Route<TAppContext>[], route) => {
    if (Array.isArray(route)) {
      return [...acc, ...flattenRoutes(route)];
    }
    return [...acc, route];
  }, []) as (RouteMiddleware<TAppContext> | RouteDefinition<TAppContext>)[];
}

export function defineRoutes<TAppContext = Record<string, any>>(
  routes: Route<TAppContext>[],
): {
  routes: Route<TAppContext>[];
  handle: ({
    cf,
    request,
    appContext,
    env,
    rw,
    headers,
  }: {
    cf: ExecutionContext;
    request: Request;
    appContext: TAppContext;
    env: Env;
    rw: RwContext<TAppContext>;
    headers: Headers;
  }) => Response | Promise<Response>;
} {
  const flattenedRoutes = flattenRoutes(routes);
  return {
    routes: flattenedRoutes,
    async handle({ cf, request, appContext, env, rw, headers }) {
      const url = new URL(request.url);
      let path = url.pathname;

      // Must end with a trailing slash.
      if (path !== "/" && !path.endsWith("/")) {
        path = path + "/";
      }

      // Find matching route
      let match: RouteMatch<TAppContext> | null = null;
      const routeOptions: RouteOptions<TAppContext> = {
        cf,
        request,
        params: {},
        appContext,
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
            appContext,
            rw: { nonce: rw.nonce },
          };
          return await rw.renderPage({
            Page: h as React.FC<Record<string, any>>,
            props,
            actionResult,
            Document: rw.Document,
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

export function route<TAppContext = any, TParams = any>(
  path: string,
  handler: RouteHandler<TAppContext, TParams>,
): RouteDefinition<TAppContext, TParams> {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index<TAppContext = any, TParams = any>(
  handler: RouteHandler<TAppContext, TParams>,
): RouteDefinition<TAppContext, TParams> {
  return route("/", handler);
}

export function prefix<TAppContext = any, TParams = any>(
  prefix: string,
  routes: ReturnType<typeof route<TAppContext, TParams>>[],
): RouteDefinition<TAppContext, TParams>[] {
  return routes.map((r) => {
    return {
      path: prefix + r.path,
      handler: r.handler,
    };
  });
}

export function render<TAppContext = any>(
  Document: React.FC<{ children: React.ReactNode }>,
  routes: Route<TAppContext>[],
): Route<TAppContext>[] {
  const documentMiddleware: RouteMiddleware<TAppContext> = ({ rw }) => {
    rw.Document = Document;
  };

  return [documentMiddleware, ...routes];
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
