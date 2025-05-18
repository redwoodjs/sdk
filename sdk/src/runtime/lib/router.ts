import type React from "react";
import { isValidElementType } from "react-is";
import { RequestInfo } from "../requestInfo/types";

export type DocumentProps = RequestInfo & {
  children: React.ReactNode;
};

export type RwContext = {
  nonce: string;
  Document: React.FC<DocumentProps>;
};

export type RouteMiddleware = (
  requestInfo: RequestInfo,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<void>
  | Promise<Response | void>;

type RouteFunction = (requestInfo: RequestInfo) => Response | Promise<Response>;

type MaybePromise<T> = T | Promise<T>;

type RouteComponent = (
  requestInfo: RequestInfo,
) => MaybePromise<React.JSX.Element | Response>;

type RouteHandler =
  | RouteFunction
  | RouteComponent
  | [...RouteMiddleware[], RouteFunction | RouteComponent];

export type Route = RouteMiddleware | RouteDefinition | Array<Route>;

export type RouteDefinition = {
  path: string;
  handler: RouteHandler;
};

type RouteMatch = {
  params: Record<string, string>;
  handler: RouteHandler;
};

export function matchPath(
  routePath: string,
  requestPath: string,
): RequestInfo["params"] | null {
  // Check for invalid pattern: multiple colons in a segment (e.g., /:param1:param2/)
  if (routePath.includes(":")) {
    const segments = routePath.split("/");
    for (const segment of segments) {
      if ((segment.match(/:/g) || []).length > 1) {
        throw new Error(
          `Invalid route pattern: segment "${segment}" in "${routePath}" contains multiple colons.`,
        );
      }
    }
  }

  // Check for invalid pattern: double wildcard (e.g., /**/)
  if (routePath.includes("**")) {
    throw new Error(
      `Invalid route pattern: "${routePath}" contains "**". Use "*" for a single wildcard segment.`,
    );
  }

  const pattern = routePath
    .replace(/:[a-zA-Z0-9]+/g, "([^/]+)") // Convert :param to capture group
    .replace(/\*/g, "(.*)"); // Convert * to wildcard capture group

  const regex = new RegExp(`^${pattern}$`);
  const matches = requestPath.match(regex);

  if (!matches) {
    return null;
  }

  // Revised parameter extraction:
  const params: RequestInfo["params"] = {};
  let currentMatchIndex = 1; // Regex matches are 1-indexed

  // This regex finds either a named parameter token (e.g., ":id") or a wildcard star token ("*").
  const tokenRegex = /:([a-zA-Z0-9_]+)|\*/g;
  let matchToken;
  let wildcardCounter = 0;

  // Ensure regex starts from the beginning of the routePath for each call if it's stateful (it is with /g)
  tokenRegex.lastIndex = 0;

  while ((matchToken = tokenRegex.exec(routePath)) !== null) {
    // Ensure we have a corresponding match from the regex execution
    if (matches[currentMatchIndex] === undefined) {
      // This case should ideally not be hit if routePath and pattern generation are correct
      // and all parts of the regex matched.
      // Consider logging a warning or throwing an error if critical.
      break;
    }

    if (matchToken[1]) {
      // This token is a named parameter (e.g., matchToken[1] is "id" for ":id")
      params[matchToken[1]] = matches[currentMatchIndex];
    } else {
      // This token is a wildcard "*"
      params[`$${wildcardCounter}`] = matches[currentMatchIndex];
      wildcardCounter++;
    }
    currentMatchIndex++;
  }

  return params;
}

function flattenRoutes(routes: Route[]): (RouteMiddleware | RouteDefinition)[] {
  return routes.reduce((acc: Route[], route) => {
    if (Array.isArray(route)) {
      return [...acc, ...flattenRoutes(route)];
    }
    return [...acc, route];
  }, []) as (RouteMiddleware | RouteDefinition)[];
}

export function defineRoutes(routes: Route[]): {
  routes: Route[];
  handle: ({
    request,
    renderPage,
    getRequestInfo,
    onError,
    runWithRequestInfoOverrides,
  }: {
    request: Request;
    renderPage: (
      requestInfo: RequestInfo,
      Page: React.FC,
      onError: (error: unknown) => void,
    ) => Promise<Response>;
    getRequestInfo: () => RequestInfo;
    onError: (error: unknown) => void;
    runWithRequestInfoOverrides: <Result>(
      overrides: Partial<RequestInfo>,
      fn: () => Promise<Result>,
    ) => Promise<Result>;
  }) => Response | Promise<Response>;
} {
  const flattenedRoutes = flattenRoutes(routes);
  return {
    routes: flattenedRoutes,
    async handle({
      request,
      renderPage,
      getRequestInfo,
      onError,
      runWithRequestInfoOverrides,
    }) {
      const url = new URL(request.url);
      let path = url.pathname;

      // Must end with a trailing slash.
      if (path !== "/" && !path.endsWith("/")) {
        path = path + "/";
      }

      // Find matching route
      let match: RouteMatch | null = null;

      for (const route of flattenedRoutes) {
        if (typeof route === "function") {
          const r = await route(getRequestInfo());

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

      return runWithRequestInfoOverrides({ params }, async () => {
        const handlers = Array.isArray(handler) ? handler : [handler];
        for (const h of handlers) {
          if (isRouteComponent(h)) {
            return await renderPage(getRequestInfo(), h as React.FC, onError);
          } else {
            const r = await (h(getRequestInfo()) as Promise<Response>);
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

export function route(path: string, handler: RouteHandler): RouteDefinition {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index(handler: RouteHandler): RouteDefinition {
  return route("/", handler);
}

export function prefix(
  prefix: string,
  routes: ReturnType<typeof route>[],
): RouteDefinition[] {
  return routes.map((r) => {
    return {
      path: prefix + r.path,
      handler: r.handler,
    };
  });
}

export function render(
  Document: React.FC<DocumentProps>,
  routes: Route[],
): Route[] {
  const documentMiddleware: RouteMiddleware = ({ rw }) => {
    rw.Document = Document;
  };

  return [documentMiddleware, ...routes];
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
