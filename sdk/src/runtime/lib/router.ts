import { isValidElementType } from "react-is";
import { ExecutionContext } from "@cloudflare/workers-types";
import {
  RequestContext,
  runWithRequestContextOverrides,
} from "../requestContext/worker";

/** @deprecated Import and use `requestContext` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
export type HandlerOptions<Data = Record<string, any>> = {
  /** @deprecated Import and use `requestContext.request` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  request: Request;
  /** @deprecated Import and use `requestContext.env` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  env: Env;
  /** @deprecated Import and use `requestContext.cf` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  cf: ExecutionContext;
  /** @deprecated Import and use `requestContext.appContext` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  appContext: Data;
  /** @deprecated Import and use `requestContext.headers` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  headers: Headers;
  /** @deprecated Import and use `requestContext.rw` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  rw: RwContext<Data>;
};

/** @deprecated Import and use `requestContext` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
export type RouteOptions<Data = Record<string, any>, Params = any> = {
  /** @deprecated Import and use `requestContext.cf` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  cf: ExecutionContext;
  /** @deprecated Import and use `requestContext.request` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  request: Request;
  /** @deprecated Import and use `requestContext.params` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  params: Params;
  /** @deprecated Use `env` from `cloudflare:workers` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  env: Env;
  /** @deprecated Import and use `requestContext.data` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  appContext: Data;
  /** @deprecated Import and use `requestContext.headers` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  headers: Headers;
  /** @deprecated Import and use `requestContext.rw` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  rw: RwContext<Data>;
};

/** @deprecated Import and use `requestContext` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
export type PageProps<Data> = Omit<
  RouteOptions<Data>,
  "request" | "headers" | "rw" | "cf"
> & {
  /** @deprecated Import and use `requestContext.rw.nonce` instead. See release notes for migration guide: https://github.com/redwoodjs/sdk/releases/tag/v0.0.52 */
  rw: { nonce: string };
};

export type DocumentProps<Data> = PageProps<Data> & {
  children: React.ReactNode;
};

export type RenderPageParams<Data> = {
  Page: React.FC<Record<string, any>>;
  props: PageProps<Data>;
  actionResult: unknown;
  Document: React.FC<DocumentProps<Data>>;
};

export type RenderPage<Data> = (
  params: RenderPageParams<Data>,
) => Promise<Response>;

export type RwContext<Data> = {
  nonce: string;
  Document: React.FC<DocumentProps<Data>>;
};

export type RouteMiddleware<Data = any> = (
  opts: RouteOptions<Data>,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<void>
  | Promise<Response | void>;
type RouteFunction<Data, Params> = (
  opts: RouteOptions<Data, Params>,
) => Response | Promise<Response>;
type RouteComponent<Data, Params> = (
  opts: RouteOptions<Data, Params>,
) => JSX.Element | Promise<JSX.Element>;

type RouteHandler<Data, Params> =
  | RouteFunction<Data, Params>
  | RouteComponent<Data, Params>
  | [
      ...RouteMiddleware<Data>[],
      RouteFunction<Data, Params> | RouteComponent<Data, Params>,
    ];

export type Route<Data> =
  | RouteMiddleware<Data>
  | RouteDefinition<Data>
  | Array<Route<Data>>;

export type RouteDefinition<Data = Record<string, any>, Params = any> = {
  path: string;
  handler: RouteHandler<Data, Params>;
};

type RouteMatch<Data = Record<string, any>, Params = any> = {
  params: Params;
  handler: RouteHandler<Data, Params>;
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

function flattenRoutes<Data>(
  routes: Route<Data>[],
): (RouteMiddleware<Data> | RouteDefinition<Data>)[] {
  return routes.reduce((acc: Route<Data>[], route) => {
    if (Array.isArray(route)) {
      return [...acc, ...flattenRoutes(route)];
    }
    return [...acc, route];
  }, []) as (RouteMiddleware<Data> | RouteDefinition<Data>)[];
}

export function defineRoutes<Data = Record<string, any>>(
  routes: Route<Data>[],
): {
  routes: Route<Data>[];
  handle: ({
    request,
    renderPage,
    deprecatedRouteOptions,
  }: {
    request: Request;
    renderPage: (Page: React.FC) => Promise<Response>;
    deprecatedRouteOptions: RouteOptions<Data>;
  }) => Response | Promise<Response>;
} {
  const flattenedRoutes = flattenRoutes(routes);
  return {
    routes: flattenedRoutes,
    async handle({ request, renderPage, deprecatedRouteOptions }) {
      const url = new URL(request.url);
      let path = url.pathname;

      // Must end with a trailing slash.
      if (path !== "/" && !path.endsWith("/")) {
        path = path + "/";
      }

      // Find matching route
      let match: RouteMatch<Data> | null = null;

      for (const route of flattenedRoutes) {
        if (typeof route === "function") {
          const r = await route(deprecatedRouteOptions);

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

      return runWithRequestContextOverrides({ params }, async () => {
        const handlers = Array.isArray(handler) ? handler : [handler];
        for (const h of handlers) {
          if (isRouteComponent(h)) {
            return await renderPage(h as React.FC);
          } else {
            const r = await (h(deprecatedRouteOptions) as Promise<Response>);
            if (r instanceof Response) {
              return r;
            }
          }
        }

        // Add fallback return
        return new Response("Response not returned from route handler", {
          status: 500,
        });
      });
    },
  };
}

export function route<Data = any, Params = any>(
  path: string,
  handler: RouteHandler<Data, Params>,
): RouteDefinition<Data, Params> {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index<Data = any, Params = any>(
  handler: RouteHandler<Data, Params>,
): RouteDefinition<Data, Params> {
  return route("/", handler);
}

export function prefix<Data = any, Params = any>(
  prefix: string,
  routes: ReturnType<typeof route<Data, Params>>[],
): RouteDefinition<Data, Params>[] {
  return routes.map((r) => {
    return {
      path: prefix + r.path,
      handler: r.handler,
    };
  });
}

export function render<Data = any>(
  Document: React.FC<{ children: React.ReactNode }>,
  routes: Route<Data>[],
): Route<Data>[] {
  const documentMiddleware: RouteMiddleware<Data> = ({ rw }) => {
    rw.Document = Document;
  };

  return [documentMiddleware, ...routes];
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
