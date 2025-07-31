import React from "react";
import { isValidElementType } from "react-is";
import { RequestInfo } from "../requestInfo/types";
import type { Kysely } from "kysely";

export type DocumentProps<T extends RequestInfo = RequestInfo> = T & {
  children: React.ReactNode;
};

export type LayoutProps<T extends RequestInfo = RequestInfo> = {
  children?: React.ReactNode;
  requestInfo?: T;
};

export type RwContext = {
  nonce: string;
  Document: React.FC<DocumentProps<any>>;
  rscPayload: boolean;
  ssr: boolean;
  layouts?: React.FC<LayoutProps<any>>[];
  databases: Map<string, Kysely<any>>;
  scriptsToBeLoaded: Set<string>;
  pageRouteResolved: PromiseWithResolvers<void> | undefined;
};

export type RouteMiddleware<T extends RequestInfo = RequestInfo> = (
  requestInfo: T,
) =>
  | Response
  | Promise<Response>
  | void
  | Promise<void>
  | Promise<Response | void>;

type RouteFunction<T extends RequestInfo = RequestInfo> = (
  requestInfo: T,
) => Response | Promise<Response>;

type MaybePromise<T> = T | Promise<T>;

type RouteComponent<T extends RequestInfo = RequestInfo> = (
  requestInfo: T,
) => MaybePromise<React.JSX.Element | Response>;

type RouteHandler<T extends RequestInfo = RequestInfo> =
  | RouteFunction<T>
  | RouteComponent<T>
  | [...RouteMiddleware<T>[], RouteFunction<T> | RouteComponent<T>];

export type Route<T extends RequestInfo = RequestInfo> =
  | RouteMiddleware<T>
  | RouteDefinition<T>
  | Array<Route<T>>;

export type RouteDefinition<T extends RequestInfo = RequestInfo> = {
  path: string;
  handler: RouteHandler<T>;
  layouts?: React.FC<LayoutProps<T>>[];
};

type RouteMatch<T extends RequestInfo = RequestInfo> = {
  params: Record<string, string>;
  handler: RouteHandler<T>;
  layouts?: React.FC<LayoutProps<T>>[];
};

export function matchPath<T extends RequestInfo = RequestInfo>(
  routePath: string,
  requestPath: string,
): T["params"] | null {
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
  const params: T["params"] = {};
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

function flattenRoutes<T extends RequestInfo = RequestInfo>(
  routes: Route<T>[],
): (RouteMiddleware<T> | RouteDefinition<T>)[] {
  return routes.reduce((acc: Route<T>[], route) => {
    if (Array.isArray(route)) {
      return [...acc, ...flattenRoutes(route)];
    }
    return [...acc, route];
  }, []) as (RouteMiddleware<T> | RouteDefinition<T>)[];
}

export function defineRoutes<T extends RequestInfo = RequestInfo>(
  routes: Route<T>[],
): {
  routes: Route<T>[];
  handle: ({
    request,
    renderPage,
    getRequestInfo,
    onError,
    runWithRequestInfoOverrides,
  }: {
    request: Request;
    renderPage: (
      requestInfo: T,
      Page: React.FC,
      onError: (error: unknown) => void,
    ) => Promise<Response>;
    getRequestInfo: () => T;
    onError: (error: unknown) => void;
    runWithRequestInfoOverrides: <Result>(
      overrides: Partial<T>,
      fn: () => Promise<Result>,
    ) => Promise<Result>;
  }) => Response | Promise<Response>;
} {
  const flattenedRoutes = flattenRoutes<T>(routes);
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
      let match: RouteMatch<T> | null = null;

      for (const route of flattenedRoutes) {
        if (typeof route === "function") {
          const r = await route(getRequestInfo());

          if (r instanceof Response) {
            return r;
          }

          continue;
        }

        const params = matchPath<T>(route.path, path);
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

      return runWithRequestInfoOverrides({ params } as Partial<T>, async () => {
        const handlers = Array.isArray(handler) ? handler : [handler];

        for (const h of handlers) {
          if (isRouteComponent(h)) {
            const requestInfo = getRequestInfo();
            const WrappedComponent = wrapWithLayouts(
              wrapHandlerToThrowResponses(h as RouteComponent<T>) as React.FC,
              layouts || [],
              requestInfo,
            );
            if (!isClientReference(WrappedComponent)) {
              // context(justinvdm, 31 Jul 2025): We now know we're dealing with a page route,
              // so we create a deferred so that we can signal when we're done determining whether
              // we're returning a response or a react element
              requestInfo.rw.pageRouteResolved = Promise.withResolvers();
            }
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

export function route<T extends RequestInfo = RequestInfo>(
  path: string,
  handler: RouteHandler<T>,
): RouteDefinition<T> {
  if (!path.endsWith("/")) {
    path = path + "/";
  }

  return {
    path,
    handler,
  };
}

export function index<T extends RequestInfo = RequestInfo>(
  handler: RouteHandler<T>,
): RouteDefinition<T> {
  return route("/", handler);
}

export function prefix<T extends RequestInfo = RequestInfo>(
  prefixPath: string,
  routes: Route<T>[],
): Route<T>[] {
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

function wrapWithLayouts<T extends RequestInfo = RequestInfo>(
  Component: React.FC,
  layouts: React.FC<LayoutProps<T>>[] = [],
  requestInfo: T,
): React.FC {
  if (layouts.length === 0) {
    return Component;
  }

  // Check if the final route component is a client component
  const isRouteClientComponent = Object.prototype.hasOwnProperty.call(
    Component,
    "$$isClientReference",
  );

  // Create nested layout structure - layouts[0] should be outermost, so use reduceRight
  return layouts.reduceRight((WrappedComponent, Layout) => {
    const Wrapped: React.FC = (props) => {
      const isClientComponent = Object.prototype.hasOwnProperty.call(
        Layout,
        "$$isClientReference",
      );

      return React.createElement(Layout, {
        children: React.createElement(
          WrappedComponent,
          isRouteClientComponent ? {} : props,
        ),
        // Only pass requestInfo to server components to avoid serialization issues
        ...(isClientComponent ? {} : { requestInfo }),
      });
    };
    return Wrapped;
  }, Component);
}

// context(justinvdm, 31 Jul 2025): We need to wrap the handler's that might
// return react elements, so that it throws the response to bubble it up and
// break out of react rendering context This way, we're able to return a
// response from the handler while still staying within react rendering context
export const wrapHandlerToThrowResponses = <
  T extends RequestInfo = RequestInfo,
>(
  handler: RouteFunction<T> | RouteComponent<T>,
): RouteHandler<T> => {
  if (
    isClientReference(handler) ||
    !isRouteComponent(handler) ||
    Object.prototype.hasOwnProperty.call(handler, "__rwsdk_route_component")
  ) {
    return handler;
  }

  const ComponentWrappedToThrowResponses = async (requestInfo: T) => {
    const result = await handler(requestInfo);

    if (result instanceof Response) {
      requestInfo.rw.pageRouteResolved?.reject(result);
      throw result;
    }

    requestInfo.rw.pageRouteResolved?.resolve();
    return result;
  };

  ComponentWrappedToThrowResponses.__rwsdk_route_component = true;
  return ComponentWrappedToThrowResponses;
};

export function layout<T extends RequestInfo = RequestInfo>(
  LayoutComponent: React.FC<LayoutProps<T>>,
  routes: Route<T>[],
): Route<T>[] {
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

export function render<T extends RequestInfo = RequestInfo>(
  Document: React.FC<DocumentProps<T>>,
  routes: Route<T>[],
  /**
   * @param options - Configuration options for rendering.
   * @param options.rscPayload - Toggle the RSC payload that's appended to the Document. Disabling this will mean that interactivity no longer works.
   * @param options.ssr - Disable sever side rendering for all these routes. This only allow client side rendering`, which requires `rscPayload` to be enabled.
   */
  options: {
    rscPayload?: boolean;
    ssr?: boolean;
  } = {},
): Route<T>[] {
  options = {
    rscPayload: true,
    ssr: true,
    ...options,
  };

  const documentMiddleware: RouteMiddleware<T> = ({ rw }) => {
    rw.Document = Document;
    rw.rscPayload = options.rscPayload ?? true;
    rw.ssr = options.ssr ?? true;
  };

  return [documentMiddleware, ...routes];
}

function isRouteComponent(handler: any) {
  return (
    Object.prototype.hasOwnProperty.call(handler, "__rwsdk_route_component") ||
    (isValidElementType(handler) && handler.toString().includes("jsx")) ||
    isClientReference(handler)
  );
}

export const isClientReference = (value: any) => {
  return Object.prototype.hasOwnProperty.call(value, "$$isClientReference");
};
