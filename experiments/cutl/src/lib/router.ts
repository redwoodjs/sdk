import { isValidElementType } from "react-is";

export type RouteOptions<TParams = Record<string, string>> = {
  request: Request;
  params: TParams;
  env: Env;
  ctx?: any;
};

type RouteMiddleware = (
  ctx: RouteOptions,
) => Response | Promise<Response> | void;
type RouteFunction = (ctx: RouteOptions) => Response | Promise<Response>;
type RouteComponent = (ctx: RouteOptions) => JSX.Element | Promise<JSX.Element>;

type RouteHandler =
  | RouteFunction
  | RouteComponent
  | [...RouteMiddleware[], RouteFunction | RouteComponent];

type RouteDefinition = {
  path: string;
  handler: RouteHandler;
};

type RouteMatch = {
  params: Record<string, string>;
  handler: RouteHandler;
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

export function defineRoutes(routes: RouteDefinition[]): {
  routes: RouteDefinition[];
  handle: ({
    request,
    ctx,
    env,
    renderPage,
  }: {
    request: Request;
    ctx: any;
    env: Env;
    renderPage: (page: any, props: Record<string, any>) => Promise<Response>;
  }) => Response | Promise<Response>;
} {
  return {
    routes,
    async handle({ request, ctx, env, renderPage }) {
      try {
        const url = new URL(request.url);
        let path = url.pathname;

        // Must end with a trailing slash.
        if (path !== "/" && !path.endsWith("/")) {
          path = path + "/";
        }

        // Find matching route
        let match: RouteMatch | null = null;
        for (const route of routes) {
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

        // Array of handlers (middleware chain)
        if (Array.isArray(handler)) {
          const handlers = handler;
          handler = handlers.pop() as RouteFunction | RouteComponent;

          // loop over each function. Only the last function can be a page function.
          for (const h of handlers) {
            if (isRouteComponent(h)) {
              throw new Error(
                "Only the last handler in an array of routes can be a React component.",
              );
            }

            const r = await h({ request, params, ctx, env });
            if (r instanceof Response) {
              return r;
            }
          }
        }

        if (isRouteComponent(handler)) {
          // TODO(peterp, 2025-01-30): Serialize the request
          return await renderPage(handler as RouteComponent, { params, ctx });
        } else {
          return await (handler({
            request,
            params,
            ctx,
            env,
          }) as Promise<Response>);
        }
      } catch (error) {
        console.error("Router Error:", {
          url: request.url,
          error:
            error instanceof Error
              ? {
                  message: error.message,
                  stack: error.stack,
                  name: error.name,
                  // Some errors might have a 'cause' property with additional details
                  cause: (error as any).cause,
                }
              : error,
        });

        return new Response(
          JSON.stringify({
            error:
              error instanceof Error
                ? {
                    message: error.message,
                    location: error.stack?.split("\n")[1]?.trim(), // This will show the first line of the stack trace
                  }
                : "An unexpected error occurred",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    },
  };
}

export function route(path: string, handler: RouteHandler) {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index(handler: RouteHandler) {
  return route("/", handler);
}

export function prefix(prefix: string, routes: ReturnType<typeof route>[]) {
  return routes.map((r) => {
    return {
      path: prefix + r.path,
      handler: r.handler,
    };
  });
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
