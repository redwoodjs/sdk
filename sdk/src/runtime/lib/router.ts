import React from "react";
import { isValidElementType } from "react-is";
import { RequestInfo } from "../requestInfo/types";
import type { DocumentProps, LayoutProps } from "./types.js";

type MaybePromise<T> = T | Promise<T>;

type BivariantRouteHandler<T extends RequestInfo, R> = {
  bivarianceHack(requestInfo: T): R;
}["bivarianceHack"];

export type RouteMiddleware<T extends RequestInfo = RequestInfo> =
  BivariantRouteHandler<T, MaybePromise<React.JSX.Element | Response | void>>;

export type ExceptHandler<T extends RequestInfo = RequestInfo> = {
  __rwExcept: true;
  handler: (
    error: unknown,
    requestInfo: T,
  ) => MaybePromise<React.JSX.Element | Response | void>;
};

type RouteFunction<T extends RequestInfo = RequestInfo> = BivariantRouteHandler<
  T,
  MaybePromise<Response>
>;

type RouteComponent<T extends RequestInfo = RequestInfo> =
  BivariantRouteHandler<T, MaybePromise<React.JSX.Element | Response | void>>;

type RouteHandler<T extends RequestInfo = RequestInfo> =
  | RouteFunction<T>
  | RouteComponent<T>
  | readonly [...RouteMiddleware<T>[], RouteFunction<T> | RouteComponent<T>];

const METHOD_VERBS = ["delete", "get", "head", "patch", "post", "put"] as const;

export type MethodVerb = (typeof METHOD_VERBS)[number];

export type MethodHandlers<T extends RequestInfo = RequestInfo> = {
  [K in MethodVerb]?: RouteHandler<T>;
} & {
  config?: {
    disable405?: true;
    disableOptions?: true;
  };
  custom?: {
    [method: string]: RouteHandler<T>;
  };
};

export type Route<T extends RequestInfo = RequestInfo> =
  | RouteMiddleware<T>
  | RouteDefinition<string, T>
  | ExceptHandler<T>
  | readonly Route<T>[];

type NormalizedRouteDefinition<T extends RequestInfo = RequestInfo> = {
  path: string;
  handler: RouteHandler<T> | MethodHandlers<T>;
  layouts?: React.FC<LayoutProps<T>>[];
};

export type RouteDefinition<
  Path extends string = string,
  T extends RequestInfo = RequestInfo,
> = NormalizedRouteDefinition<T> & {
  readonly __rwPath?: Path;
};

type TrimTrailingSlash<S extends string> = S extends `${infer Head}/`
  ? TrimTrailingSlash<Head>
  : S;

type TrimLeadingSlash<S extends string> = S extends `/${infer Rest}`
  ? TrimLeadingSlash<Rest>
  : S;

type NormalizePrefix<Prefix extends string> =
  TrimTrailingSlash<TrimLeadingSlash<Prefix>> extends ""
    ? ""
    : `/${TrimTrailingSlash<TrimLeadingSlash<Prefix>>}`;

type NormalizePath<Path extends string> =
  TrimTrailingSlash<Path> extends "/"
    ? "/"
    : `/${TrimTrailingSlash<TrimLeadingSlash<Path>>}`;

type JoinPaths<Prefix extends string, Path extends string> =
  NormalizePrefix<Prefix> extends ""
    ? NormalizePath<Path>
    : Path extends "/"
      ? NormalizePrefix<Prefix>
      : `${NormalizePrefix<Prefix>}${NormalizePath<Path>}`;

type PrefixedRouteValue<Prefix extends string, Value> =
  Value extends RouteDefinition<infer Path, infer Req>
    ? RouteDefinition<JoinPaths<Prefix, Path>, Req>
    : Value extends ExceptHandler<any>
      ? Value
      : Value extends readonly Route<any>[]
        ? PrefixedRouteArray<Prefix, Value>
        : Value;

type PrefixedRouteArray<
  Prefix extends string,
  Routes extends readonly Route<any>[],
> = Routes extends readonly []
  ? []
  : Routes extends readonly [infer Head, ...infer Tail]
    ? readonly [
        PrefixedRouteValue<Prefix, Head>,
        ...PrefixedRouteArray<
          Prefix,
          Tail extends readonly Route<any>[] ? Tail : []
        >,
      ]
    : ReadonlyArray<PrefixedRouteValue<Prefix, Routes[number]>>;

type RouteMatch<T extends RequestInfo = RequestInfo> = {
  params: Record<string, string>;
  handler: RouteHandler<T>;
  layouts?: React.FC<LayoutProps<T>>[];
};

type CompiledPath = {
  isStatic: boolean;
  regex: RegExp | null;
  paramMap: { name: string; isWildcard: boolean }[];
};

const pathCache = new Map<string, CompiledPath>();

function compilePath(routePath: string): CompiledPath {
  const cached = pathCache.get(routePath);
  if (cached) return cached;

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

  const isStatic = !routePath.includes(":") && !routePath.includes("*");
  if (isStatic) {
    const result = { isStatic: true, regex: null, paramMap: [] };
    pathCache.set(routePath, result);
    return result;
  }

  const paramMap: { name: string; isWildcard: boolean }[] = [];
  let wildcardCounter = 0;
  const tokenRegex = /:([a-zA-Z0-9_]+)|\*/g;
  let matchToken;
  while ((matchToken = tokenRegex.exec(routePath)) !== null) {
    if (matchToken[1]) {
      paramMap.push({ name: matchToken[1], isWildcard: false });
    } else {
      paramMap.push({ name: `$${wildcardCounter++}`, isWildcard: true });
    }
  }

  const pattern = routePath
    .replace(/:[a-zA-Z0-9]+/g, "([^/]+)") // Convert :param to capture group
    .replace(/\*/g, "(.*)"); // Convert * to wildcard capture group

  const result = {
    isStatic: false,
    regex: new RegExp(`^${pattern}$`),
    paramMap,
  };
  pathCache.set(routePath, result);
  return result;
}

export function matchPath<T extends RequestInfo = RequestInfo>(
  routePath: string,
  requestPath: string,
): T["params"] | null {
  const compiled = compilePath(routePath);

  if (compiled.isStatic) {
    return routePath === requestPath ? {} : null;
  }

  const matches = requestPath.match(compiled.regex!);
  if (!matches) {
    return null;
  }

  const params: T["params"] = {};
  for (let i = 0; i < compiled.paramMap.length; i++) {
    const param = compiled.paramMap[i];
    params[param.name] = matches[i + 1];
  }

  return params;
}

function flattenRoutes<T extends RequestInfo = RequestInfo>(
  routes: readonly Route<T>[],
): (RouteMiddleware<T> | RouteDefinition<string, T> | ExceptHandler<T>)[] {
  return routes.reduce<
    (RouteMiddleware<T> | RouteDefinition<string, T> | ExceptHandler<T>)[]
  >((acc, route) => {
    if (Array.isArray(route)) {
      return [...acc, ...flattenRoutes(route)];
    }
    return [
      ...acc,
      route as
        | RouteMiddleware<T>
        | RouteDefinition<string, T>
        | ExceptHandler<T>,
    ];
  }, []);
}

function isMethodHandlers<T extends RequestInfo = RequestInfo>(
  handler: RouteHandler<T> | MethodHandlers<T>,
): handler is MethodHandlers<T> {
  return (
    typeof handler === "object" && handler !== null && !Array.isArray(handler)
  );
}

function handleOptionsRequest<T extends RequestInfo = RequestInfo>(
  methodHandlers: MethodHandlers<T>,
): Response {
  const methods = new Set<string>([
    ...(methodHandlers.config?.disableOptions ? [] : ["OPTIONS"]),
    ...METHOD_VERBS.filter((verb) => methodHandlers[verb]).map((verb) =>
      verb.toUpperCase(),
    ),
    ...Object.keys(methodHandlers.custom ?? {}).map((method) =>
      method.toUpperCase(),
    ),
  ]);

  return new Response(null, {
    status: 204,
    headers: {
      Allow: Array.from(methods).sort().join(", "),
    },
  });
}

function handleMethodNotAllowed<T extends RequestInfo = RequestInfo>(
  methodHandlers: MethodHandlers<T>,
): Response {
  const optionsResponse = handleOptionsRequest(methodHandlers);
  return new Response("Method Not Allowed", {
    status: 405,
    headers: optionsResponse.headers,
  });
}

function getHandlerForMethod<T extends RequestInfo = RequestInfo>(
  methodHandlers: MethodHandlers<T>,
  method: string,
): RouteHandler<T> | undefined {
  const lowerMethod = method.toLowerCase();

  // Check standard method verbs
  if (METHOD_VERBS.includes(lowerMethod as MethodVerb)) {
    return methodHandlers[lowerMethod as MethodVerb];
  }

  // Check custom methods (already normalized to lowercase)
  return methodHandlers.custom?.[lowerMethod];
}

type CompiledRoute<T extends RequestInfo = RequestInfo> =
  | { type: "middleware"; handler: RouteMiddleware<T> }
  | { type: "except"; handler: ExceptHandler<T> }
  | {
      type: "definition";
      path: string;
      handler: RouteHandler<T> | MethodHandlers<T>;
      layouts?: React.FC<LayoutProps<T>>[];
      isStatic: boolean;
      regex?: RegExp;
      paramNames: string[];
      wildcardCount: number;
    };

export function defineRoutes<T extends RequestInfo = RequestInfo>(
  routes: readonly Route<T>[],
): {
  routes: Route<T>[];
  handle: ({
    request,
    renderPage,
    getRequestInfo,
    onError,
    runWithRequestInfoOverrides,
    rscActionHandler,
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
    rscActionHandler: (request: Request) => Promise<unknown>;
  }) => Response | Promise<Response>;
} {
  const flattenedRoutes = flattenRoutes<T>(routes);
  const compiledRoutes: CompiledRoute<T>[] = flattenedRoutes.map((route) => {
    if (typeof route === "function") {
      return { type: "middleware", handler: route };
    }
    if (
      typeof route === "object" &&
      route !== null &&
      "__rwExcept" in route &&
      route.__rwExcept === true
    ) {
      return { type: "except", handler: route };
    }

    const routeDef = route as RouteDefinition<string, T>;
    const compiledPath = compilePath(routeDef.path);

    return {
      type: "definition",
      path: routeDef.path,
      handler: routeDef.handler,
      layouts: routeDef.layouts,
      isStatic: compiledPath.isStatic,
      regex: compiledPath.regex ?? undefined,
      paramNames: compiledPath.paramMap
        .filter((p) => !p.isWildcard)
        .map((p) => p.name),
      wildcardCount: compiledPath.paramMap.filter((p) => p.isWildcard).length,
    };
  });

  return {
    routes: flattenedRoutes,
    async handle({
      request,
      renderPage,
      getRequestInfo,
      onError,
      runWithRequestInfoOverrides,
      rscActionHandler,
    }) {
      const requestInfo = getRequestInfo();
      const url = new URL(request.url);
      let path = url.pathname;
      if (path !== "/" && !path.endsWith("/")) {
        path = path + "/";
      }
      requestInfo.path = path;

      // --- Helpers ---
      // (Hoisted for readability)
      function parseHandlers(handler: RouteHandler<T>) {
        const handlers = Array.isArray(handler) ? handler : [handler];
        const routeMiddlewares = handlers.slice(
          0,
          Math.max(handlers.length - 1, 0),
        );
        const componentHandler = handlers[handlers.length - 1];
        return {
          routeMiddlewares: routeMiddlewares as RouteMiddleware<T>[],
          componentHandler,
        };
      }

      function renderElement(element: React.ReactElement) {
        const requestInfo = getRequestInfo();
        // Try to preserve the component name from the element's type
        const elementType = element.type;
        const componentName =
          typeof elementType === "function" && elementType.name
            ? elementType.name
            : "Element";
        const Element: React.FC = () => element;
        // Set the name for better debugging
        Object.defineProperty(Element, "name", {
          value: componentName,
          configurable: true,
        });
        return renderPage(requestInfo, Element, onError);
      }

      async function handleMiddlewareResult(
        result: Response | React.JSX.Element | void,
      ): Promise<Response | undefined> {
        if (result instanceof Response) {
          return result;
        }
        if (result && React.isValidElement(result)) {
          return await renderElement(result);
        }
        return undefined;
      }

      function isExceptHandler(
        route: CompiledRoute<T>,
      ): route is { type: "except"; handler: ExceptHandler<T> } {
        return route.type === "except";
      }

      async function executeExceptHandlers(
        error: unknown,
        startIndex: number,
      ): Promise<Response> {
        // Search backwards from startIndex to find the most recent except handler
        for (let i = startIndex; i >= 0; i--) {
          const route = compiledRoutes[i];
          if (isExceptHandler(route)) {
            try {
              const result = await route.handler.handler(
                error,
                getRequestInfo(),
              );
              const handled = await handleMiddlewareResult(result);
              if (handled) {
                return handled;
              }
              // If the handler didn't return a Response or JSX, continue to next handler (further back)
            } catch (nextError) {
              // If the except handler itself throws, try the next one (further back)
              return await executeExceptHandlers(nextError, i - 1);
            }
          }
        }
        // No handler found, throw to top-level onError
        onError(error);
        throw error;
      }

      // --- Main flow ---
      let firstRouteDefinitionEncountered = false;
      let actionHandled = false;
      const handleAction = async () => {
        // Handle RSC actions once per request, based on the incoming URL.
        if (!actionHandled) {
          const url = new URL(request.url);
          if (url.searchParams.has("__rsc_action_id")) {
            requestInfo.rw.actionResult = await rscActionHandler(request);
          }
          actionHandled = true;
        }
      };

      try {
        let currentRouteIndex = 0;
        for (const route of compiledRoutes) {
          // Skip except handlers during normal execution
          if (route.type === "except") {
            currentRouteIndex++;
            continue;
          }

          if (route.type === "middleware") {
            // This is a global middleware.
            try {
              const result = await route.handler(getRequestInfo());
              const handled = await handleMiddlewareResult(result);
              if (handled) {
                return handled; // Short-circuit
              }
            } catch (error) {
              return await executeExceptHandlers(error, currentRouteIndex);
            }
            currentRouteIndex++;
            continue;
          }

          // This is a RouteDefinition (route.type === "definition").
          // The first time we see one, we handle any RSC actions.
          if (!firstRouteDefinitionEncountered) {
            firstRouteDefinitionEncountered = true;
            try {
              await handleAction();
            } catch (error) {
              return await executeExceptHandlers(error, currentRouteIndex);
            }
          }

          let params: T["params"] | null = null;
          if (route.isStatic) {
            if (route.path === path) {
              params = {};
            }
          } else if (route.regex) {
            const matches = path.match(route.regex);
            if (matches) {
              params = {};
              for (let i = 0; i < route.paramNames.length; i++) {
                params[route.paramNames[i]] = matches[i + 1];
              }
              for (let i = 0; i < route.wildcardCount; i++) {
                params[`$${i}`] = matches[route.paramNames.length + i + 1];
              }
            }
          }

          if (!params) {
            currentRouteIndex++;
            continue; // Not a match, keep going.
          }

          // Resolve handler if method-based routing
          let handler: RouteHandler<T> | undefined;
          if (isMethodHandlers(route.handler)) {
            const requestMethod = request.method;

            // Handle OPTIONS request
            if (
              requestMethod === "OPTIONS" &&
              !route.handler.config?.disableOptions
            ) {
              return handleOptionsRequest(route.handler);
            }

            // Try to find handler for the request method
            handler = getHandlerForMethod(route.handler, requestMethod);

            if (!handler) {
              // Method not supported for this route
              if (!route.handler.config?.disable405) {
                return handleMethodNotAllowed(route.handler);
              }
              // If 405 is disabled, continue to next route
              currentRouteIndex++;
              continue;
            }
          } else {
            handler = route.handler;
          }

          // Found a match: run route-specific middlewares, then the final component, then stop.
          try {
            return await runWithRequestInfoOverrides(
              { params } as Partial<T>,
              async () => {
                const { routeMiddlewares, componentHandler } = parseHandlers(
                  handler!,
                );

                // Route-specific middlewares
                for (const mw of routeMiddlewares) {
                  const result = await mw(getRequestInfo());
                  const handled = await handleMiddlewareResult(result);
                  if (handled) {
                    return handled;
                  }
                }

                // Final component/handler
                if (isRouteComponent(componentHandler)) {
                  const requestInfo = getRequestInfo();
                  const WrappedComponent = wrapWithLayouts(
                    wrapHandlerToThrowResponses(
                      componentHandler as RouteComponent<T>,
                    ) as React.FC,
                    route.layouts || [],
                    requestInfo,
                  );

                  if (!isClientReference(componentHandler)) {
                    requestInfo.rw.pageRouteResolved = Promise.withResolvers();
                  }

                  return await renderPage(
                    requestInfo,
                    WrappedComponent,
                    onError,
                  );
                }

                // Handle non-component final handler (e.g., returns new Response)
                const tailResult = await (componentHandler(
                  getRequestInfo(),
                ) as Promise<Response | React.JSX.Element | void>);
                const handledTail = await handleMiddlewareResult(tailResult);
                if (handledTail) {
                  return handledTail;
                }

                return new Response(
                  "Response not returned from route handler",
                  {
                    status: 500,
                  },
                );
              },
            );
          } catch (error) {
            return await executeExceptHandlers(error, currentRouteIndex);
          }
        }

        // If we've gotten this far, no route was matched.
        // We still need to handle a possible action if the app has no route definitions at all.
        if (!firstRouteDefinitionEncountered) {
          try {
            await handleAction();
          } catch (error) {
            return await executeExceptHandlers(
              error,
              compiledRoutes.length - 1,
            );
          }
        }

        return new Response("Not Found", { status: 404 });
      } catch (error) {
        // Top-level catch for any unhandled errors
        return await executeExceptHandlers(error, compiledRoutes.length - 1);
      }
    },
  };
}

/**
 * Defines a route handler for a path pattern.
 *
 * Supports three types of path patterns:
 * - Static: /about, /contact
 * - Parameters: /users/:id, /posts/:postId/edit
 * - Wildcards: /files/\*, /api/\*\/download
 *
 * @example
 * // Static route
 * route("/about", () => <AboutPage />)
 *
 * @example
 * // Route with parameters
 * route("/users/:id", ({ params }) => {
 *   return <UserProfile userId={params.id} />
 * })
 *
 * @example
 * // Route with wildcards
 * route("/files/*", ({ params }) => {
 *   const filePath = params.$0
 *   return <FileViewer path={filePath} />
 * })
 *
 * @example
 * // Method-based routing
 * route("/api/users", {
 *   get: () => Response.json(users),
 *   post: ({ request }) => Response.json({ status: "created" }, { status: 201 }),
 *   delete: () => new Response(null, { status: 204 }),
 * })
 *
 * @example
 * // Route with middleware array
 * route("/admin", [isAuthenticated, isAdmin, () => <AdminDashboard />])
 */
export function route<Path extends string, T extends RequestInfo = RequestInfo>(
  path: Path,
  handler: RouteHandler<T> | MethodHandlers<T>,
): RouteDefinition<NormalizePath<Path>, T> {
  let normalizedPath: string = path;

  if (!normalizedPath.endsWith("/")) {
    normalizedPath = normalizedPath + "/";
  }

  // Normalize custom method keys to lowercase
  if (isMethodHandlers(handler) && handler.custom) {
    handler = {
      ...handler,
      custom: Object.fromEntries(
        Object.entries(handler.custom).map(([method, methodHandler]) => [
          method.toLowerCase(),
          methodHandler,
        ]),
      ),
    };
  }

  return {
    path: normalizedPath,
    handler,
    __rwPath: normalizedPath as NormalizePath<Path>,
  } as RouteDefinition<NormalizePath<Path>, T>;
}

/**
 * Defines a route handler for the root path "/".
 *
 * @example
 * // Homepage
 * index(() => <HomePage />)
 *
 * @example
 * // With middleware
 * index([logRequest, () => <HomePage />])
 */
export function index<T extends RequestInfo = RequestInfo>(
  handler: RouteHandler<T>,
): RouteDefinition<"/", T> {
  return route("/", handler);
}

/**
 * Defines an error handler that catches errors from routes, middleware, and RSC actions.
 *
 * @example
 * // Global error handler
 * except((error, requestInfo) => {
 *   console.error(error);
 *   return new Response("Internal Server Error", { status: 500 });
 * })
 *
 * @example
 * // Error handler that returns a React component
 * except((error) => {
 *   return <ErrorPage error={error} />;
 * })
 */
export function except<T extends RequestInfo = RequestInfo>(
  handler: (
    error: unknown,
    requestInfo: T,
  ) => MaybePromise<React.JSX.Element | Response | void>,
): ExceptHandler<T> {
  return { __rwExcept: true, handler };
}

/**
 * Prefixes a group of routes with a path.
 *
 * @example
 * // Organize blog routes under /blog
 * const blogRoutes = [
 *   route("/", () => <BlogIndex />),
 *   route("/post/:id", ({ params }) => <BlogPost id={params.id} />),
 *   route("/admin", [isAuthenticated, () => <BlogAdmin />]),
 * ]
 *
 * // In worker.tsx
 * defineApp([
 *   render(Document, [
 *     route("/", () => <HomePage />),
 *     prefix("/blog", blogRoutes),
 *   ]),
 * ])
 */
export function prefix<
  Prefix extends string,
  T extends RequestInfo = RequestInfo,
  Routes extends readonly Route<T>[] = readonly Route<T>[],
>(prefixPath: Prefix, routes: Routes): PrefixedRouteArray<Prefix, Routes> {
  const normalizedPrefix = prefixPath.endsWith("/")
    ? prefixPath
    : prefixPath + "/";

  const prefixed = routes.map((r) => {
    if (typeof r === "function") {
      const middleware: RouteMiddleware<T> = (requestInfo) => {
        if (
          requestInfo.path === prefixPath ||
          requestInfo.path.startsWith(normalizedPrefix)
        ) {
          return r(requestInfo);
        }
        return;
      };
      return middleware as PrefixedRouteValue<Prefix, typeof r>;
    }
    if (
      typeof r === "object" &&
      r !== null &&
      "__rwExcept" in r &&
      r.__rwExcept === true
    ) {
      // Pass through ExceptHandler as-is
      return r as PrefixedRouteValue<Prefix, typeof r>;
    }
    if (Array.isArray(r)) {
      // Recursively process nested route arrays
      return prefix(prefixPath, r) as PrefixedRouteValue<Prefix, typeof r>;
    }
    const routeDef = r as RouteDefinition<string, T>;
    const combinedPath = prefixPath + routeDef.path;
    const normalizedCombinedPath = combinedPath.replace(/\/+/g, "/");

    return {
      path: normalizedCombinedPath,
      handler: routeDef.handler,
      ...(routeDef.layouts && { layouts: routeDef.layouts }),
    } as PrefixedRouteValue<Prefix, typeof r>;
  }) as PrefixedRouteArray<Prefix, Routes>;

  return prefixed;
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

/**
 * Wraps routes with a layout component.
 *
 * @example
 * // Define a layout component
 * function BlogLayout({ children }: { children?: React.ReactNode }) {
 *   return (
 *     <div>
 *       <nav>Blog Navigation</nav>
 *       <main>{children}</main>
 *     </div>
 *   )
 * }
 *
 * // Apply layout to routes
 * const blogRoutes = layout(BlogLayout, [
 *   route("/", () => <BlogIndex />),
 *   route("/post/:id", ({ params }) => <BlogPost id={params.id} />),
 * ])
 */
export function layout<
  T extends RequestInfo = RequestInfo,
  Routes extends readonly Route<T>[] = readonly Route<T>[],
>(LayoutComponent: React.FC<LayoutProps<T>>, routes: Routes): Routes {
  return routes.map((route) => {
    if (typeof route === "function") {
      // Pass through middleware as-is
      return route;
    }
    if (
      typeof route === "object" &&
      route !== null &&
      "__rwExcept" in route &&
      route.__rwExcept === true
    ) {
      // Pass through ExceptHandler as-is
      return route;
    }
    if (Array.isArray(route)) {
      // Recursively process nested route arrays
      return layout(LayoutComponent, route) as Route<T>;
    }
    const routeDef = route as RouteDefinition<string, T>;
    return {
      ...routeDef,
      layouts: [LayoutComponent, ...(routeDef.layouts || [])],
    } as Route<T>;
  }) as unknown as Routes;
}

/**
 * Wraps routes with a Document component and configures rendering options.
 *
 * @param options.rscPayload - Toggle the RSC payload that's appended to the Document. Disabling this will mean that interactivity no longer works.
 * @param options.ssr - Disable sever side rendering for all these routes. This only allow client side rendering, which requires `rscPayload` to be enabled.
 *
 * @example
 * // Basic usage
 * defineApp([
 *   render(Document, [
 *     route("/", () => <HomePage />),
 *     route("/about", () => <AboutPage />),
 *   ]),
 * ])
 *
 * @example
 * // With custom rendering options
 * render(Document, [
 *   route("/", () => <HomePage />),
 * ], {
 *   rscPayload: true,
 *   ssr: true,
 * })
 */
type RenderedRoutes<
  T extends RequestInfo,
  Routes extends readonly Route<T>[],
> = readonly [RouteMiddleware<T>, ...Routes];

export function render<
  T extends RequestInfo = RequestInfo,
  Routes extends readonly Route<T>[] = readonly Route<T>[],
>(
  Document: React.FC<DocumentProps<T>>,
  routes: Routes,
  options: {
    rscPayload?: boolean;
    ssr?: boolean;
  } = {},
): RenderedRoutes<T, Routes> {
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

  return [documentMiddleware, ...routes] as unknown as RenderedRoutes<
    T,
    Routes
  >;
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
