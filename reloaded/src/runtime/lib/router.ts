import { isValidElementType } from "react-is";

export type RouteContext<TContext = Record<string, any>, TParams = Record<string, string>> = {
  request: Request;
  params: TParams;
  env: Env;
  ctx: TContext;
  rw: RwContext<TContext>;
};

export type RwContext<TContext> = {
  Layout: React.FC<{ children: React.ReactNode }>;
  renderPage: (params: { Page: React.FC<Record<string, any>>, props: RouteContext<TContext>, actionResult: unknown, Layout: React.FC<{ children: React.ReactNode }> } ) => Promise<Response>;
  handleAction: (ctx: TContext) => Promise<unknown>;
}

type RouteMiddleware<TContext> = (
  ctx: RouteContext<TContext>,
) => Response | Promise<Response> | void;
type RouteFunction<TContext> = (ctx: RouteContext<TContext>) => Response | Promise<Response>;
type RouteComponent<TContext> = (ctx: RouteContext<TContext>) => JSX.Element | Promise<JSX.Element>;

type RouteHandler<TContext> =
  | RouteFunction<TContext>
  | RouteComponent<TContext>
  | [...RouteMiddleware<TContext>[], RouteFunction<TContext> | RouteComponent<TContext>];

export type RouteDefinition<TContext = Record<string, any>> = {
  path: string;
  handler: RouteHandler<TContext>;
};

type RouteMatch<TContext = Record<string, any>> = {
  params: Record<string, string>;
  handler: RouteHandler<TContext>;
};

function matchPath(
  routePath: string,
  requestPath: string,
): RouteContext["params"] | null {
  const pattern = routePath
    .replace(/:[a-zA-Z]+/g, "([^/]+)") // Convert :param to capture group
    .replace(/\*/g, "(.*)"); // Convert * to wildcard capture group

  const regex = new RegExp(`^${pattern}$`);
  const matches = requestPath.match(regex);

  if (!matches) {
    return null;
  }

  // Extract named parameters and wildcards
  const params: RouteContext["params"] = {};
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

function serializeEnv(env: Env): Env {
  return Object.fromEntries(
    Object.entries(env).filter(([_, value]) =>
      ['string', 'number', 'boolean'].includes(typeof value)
    )
  ) as Env;
}

export function defineRoutes<TContext>(routes: RouteDefinition<TContext>[]): {
  routes: RouteDefinition<TContext>[];
  handle: (
    {
      request,
      ctx,
      env,
      rw,
    }: {
      request: Request;
      ctx: TContext;
      env: Env;
      rw: RwContext<TContext>;
    },
  ) => Response | Promise<Response>;
} {
  return {
    routes,
    async handle({ request, ctx, env, rw }) {
      const url = new URL(request.url);
      let path = url.pathname;

      // Must end with a trailing slash.
      if (path !== "/" && !path.endsWith("/")) {
        path = path + "/";
      }

      // Find matching route
      let match: RouteMatch<TContext> | null = null;

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
        const handlers = [...handler]
        handler = handlers.pop() as RouteFunction<TContext> | RouteComponent<TContext>;

        // loop over each function. Only the last function can be a page function.
        for (const h of handlers) {
          if (isRouteComponent(h)) {
            throw new Error(
              "Only the last handler in an array of routes can be a React component.",
            );
          }

          const r = await h({ request, params, ctx, env, rw });
          if (r instanceof Response) {
            return r;
          }
        }
      }

      if (isRouteComponent(handler)) {
        const actionResult = await rw.handleAction(ctx);
        const serializedEnv = serializeEnv(env);
        const props = { request, params, env: serializedEnv, ctx, rw };
        return await rw.renderPage({ Page: handler as React.FC<Record<string, any>>, props, actionResult, Layout: rw.Layout});
      } else {
        return await (handler({ request, params, ctx, env, rw }) as Promise<Response>);
      }
    },
  };
}

export function route<TContext>(path: string, handler: RouteHandler<TContext>) {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index<TContext>(handler: RouteHandler<TContext>) {
  return route("/", handler);
}

export function prefix<TContext>(prefix: string, routes: ReturnType<typeof route<TContext>>[]) {
  return routes.map((r) => {
    return {
      path: prefix + r.path,
      handler: r.handler,
    };
  });
}

export function middleware<TContext>(middleware: RouteMiddleware<TContext> | RouteMiddleware<TContext>[], definitions: RouteDefinition<TContext>[]) {
  return definitions.map((d) => {
    return {
      path: d.path,
      handler: [
        ...Array.isArray(middleware) ? middleware : [middleware],
        ...Array.isArray(d.handler) ? d.handler : [d.handler],
      ]
    };
  });
}

export function layout<TContext>(Layout: React.FC<{ children: React.ReactNode }>, definitions: RouteDefinition<TContext>[]) {
  const layoutMiddleware: RouteMiddleware<TContext> = ({ rw }) => {
    rw.Layout = Layout;
  }

  return middleware(layoutMiddleware, definitions);
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
