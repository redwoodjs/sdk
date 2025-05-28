import React from "react";
import { isValidElementType } from "react-is";
import { RequestInfo } from "../requestInfo/types";

export type DocumentProps = RequestInfo & {
  children: React.ReactNode;
};

export type LayoutProps = {
  children?: React.ReactNode;
  requestInfo?: RequestInfo;
};

export type RwContext = {
  nonce: string;
  Document: React.FC<DocumentProps>;
  rscPayload: boolean;
  layouts?: React.FC<LayoutProps>[];
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
  layouts?: React.FC<LayoutProps>[];
};

type RouteMatch = {
  params: Record<string, string>;
  handler: RouteHandler;
  layouts?: React.FC<LayoutProps>[];
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
  if (routePath.indexOf("**") !== -1) {
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
          match = { params, handler: route.handler, layouts: route.layouts };
          break;
        }
      }

      if (!match) {
        // todo(peterp, 2025-01-28): Allow the user to define their own "not found" route.
        return new Response("Not Found", { status: 404 });
      }

      let { params, handler, layouts } = match;

      return runWithRequestInfoOverrides({ params }, async () => {
        const handlers = Array.isArray(handler) ? handler : [handler];

        for (const h of handlers) {
          if (isRouteComponent(h)) {
            const requestInfo = getRequestInfo();
            const WrappedComponent = wrapWithLayouts(
              h as React.FC,
              layouts || [],
              requestInfo,
            );
            return await renderPage(requestInfo, WrappedComponent, onError);
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

export function prefix(prefixPath: string, routes: Route[]): Route[] {
  return routes.map((r) => {
    if (typeof r === "function") {
      // Pass through middleware as-is
      return r;
    }
    if (Array.isArray(r)) {
      // Recursively process nested route arrays
      return prefix(prefixPath, r);
    }
    // For RouteDefinition objects, update the path and preserve layouts
    return {
      path: prefixPath + r.path,
      handler: r.handler,
      ...(r.layouts && { layouts: r.layouts }),
    };
  });
}

function wrapWithLayouts(
  Component: React.FC,
  layouts: React.FC<LayoutProps>[] = [],
  requestInfo: RequestInfo,
): React.FC {
  if (layouts.length === 0) {
    return Component;
  }

  // Create nested layout structure - layouts[0] should be outermost, so use reduceRight
  return layouts.reduceRight((WrappedComponent, Layout) => {
    const Wrapped: React.FC = (props) => {
      const layoutStr = Layout.toString();
      const isClientComponent =
        layoutStr.includes('"use client"') ||
        layoutStr.includes("'use client'");

      return React.createElement(Layout, {
        children: React.createElement(WrappedComponent, props),
        // Only pass requestInfo to server components to avoid serialization issues
        ...(isClientComponent ? {} : { requestInfo }),
      });
    };
    return Wrapped;
  }, Component);
}

export function layout(
  LayoutComponent: React.FC<LayoutProps>,
  routes: Route[],
): Route[] {
  // Attach layouts directly to route definitions
  return routes.map((route) => {
    if (typeof route === "function") {
      // Pass through middleware as-is
      return route;
    }
    if (Array.isArray(route)) {
      // Recursively process nested route arrays
      return layout(LayoutComponent, route);
    }
    // For RouteDefinition objects, prepend the layout so outer layouts come first
    return {
      ...route,
      layouts: [LayoutComponent, ...(route.layouts || [])],
    };
  });
}

export function render(
  Document: React.FC<DocumentProps>,
  routes: Route[],
  /**
   * @param options - Configuration options for rendering.
   * @param options.rscPayload - Toggle the RSC payload that's appended to the Document. Disabling this will mean that interactivity no longer works.
   */
  options: {
    rscPayload: boolean;
  } = { rscPayload: true },
): Route[] {
  const documentMiddleware: RouteMiddleware = ({ rw }) => {
    rw.Document = Document;
    rw.rscPayload = options.rscPayload;
  };

  return [documentMiddleware, ...routes];
}

function isRouteComponent(handler: any) {
  return isValidElementType(handler) && handler.toString().includes("jsx");
}
