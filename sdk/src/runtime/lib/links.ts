import type { RouteDefinition, RouteMiddleware } from "./router";

type PathParams<Path extends string> =
  Path extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & PathParams<Rest>
    : Path extends `${string}:${infer Param}`
      ? { [K in Param]: string }
      : Path extends `${string}*${infer Rest}`
        ? { $0: string } & PathParams<Rest>
        : Path extends `${string}*`
          ? { $0: string }
          : {};

type ParamsForPath<Path extends string> =
  PathParams<Path> extends Record<string, never> ? undefined : PathParams<Path>;

export type LinkFunction<Paths extends string> = {
  <Path extends Paths>(path: Path, params?: ParamsForPath<Path>): string;
};

type RoutePaths<Value> =
  Value extends RouteDefinition<infer Path, any>
    ? Path
    : Value extends readonly (infer Item)[]
      ? RouteArrayPaths<Value>
      : Value extends RouteMiddleware<any>
        ? never
        : never;

type RouteArrayPaths<Routes extends readonly any[]> =
  number extends Routes["length"]
    ? RoutePaths<Routes[number]>
    : Routes extends readonly [infer Head, ...infer Tail]
      ? RoutePaths<Head> | RouteArrayPaths<Tail>
      : never;

type AppRoutes<App> = App extends { __rwRoutes: infer Routes } ? Routes : never;

export type AppRoutePaths<App> = RoutePaths<AppRoutes<App>>;

export type AppLink<App> = LinkFunction<AppRoutePaths<App>>;

export function linkFor<App>(): AppLink<App> {
  return createLinkFunction<AppRoutePaths<App>>();
}

export function createLinks<App>(_app?: App): AppLink<App> {
  return linkFor<App>();
}

// Overload for automatic route inference from app type
export function defineLinks<App extends { __rwRoutes: any }>(): AppLink<App>;
// Overload for manual route array
export function defineLinks<const T extends readonly string[]>(
  routes: T,
): LinkFunction<T[number]>;
// Implementation
export function defineLinks(routes?: readonly string[]): LinkFunction<any> {
  // If no routes provided, this is the app type overload
  // At runtime, we can't distinguish, but the type system ensures
  // this only happens when called as defineLinks<App>()
  // We delegate to linkFor which handles app types correctly
  if (routes === undefined) {
    // This branch is only reachable when called as defineLinks<App>()
    // The return type is AppLink<App> due to the overload
    // We use linkFor internally which doesn't need runtime route validation
    return linkFor<any>() as any;
  }

  // Original implementation for route arrays
  routes.forEach((route) => {
    if (typeof route !== "string") {
      throw new Error(
        `RedwoodSDK: Invalid route: ${route}. Routes must be string literals. Ensure you're passing an array of route paths.`,
      );
    }
  });

  const link = createLinkFunction<(typeof routes)[number]>();
  return ((path: (typeof routes)[number], params?: Record<string, string>) => {
    if (!routes.includes(path)) {
      throw new Error(
        `RedwoodSDK: Invalid route: ${path}. This route is not included in the routes array passed to defineLinks(). Check for typos or ensure the route is defined in your router.`,
      );
    }
    return link(path, params as any);
  }) as LinkFunction<(typeof routes)[number]>;
}

const TOKEN_REGEX = /:([a-zA-Z0-9_]+)|\*/g;

function createLinkFunction<Paths extends string>(): LinkFunction<Paths> {
  return ((path: string, params?: Record<string, string>) => {
    const expectsParams = hasRouteParameters(path);

    if (!params || Object.keys(params).length === 0) {
      if (expectsParams) {
        throw new Error(
          `RedwoodSDK: Route ${path} requires an object of parameters (e.g., link("${path}", { id: "123" })).`,
        );
      }
      return path;
    }

    return interpolate(path, params);
  }) as LinkFunction<Paths>;
}

function hasRouteParameters(path: string): boolean {
  TOKEN_REGEX.lastIndex = 0;
  const result = TOKEN_REGEX.test(path);
  TOKEN_REGEX.lastIndex = 0;
  return result;
}

function interpolate(template: string, params: Record<string, string>): string {
  let result = "";
  let lastIndex = 0;
  let wildcardIndex = 0;
  const consumed = new Set<string>();

  TOKEN_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_REGEX.exec(template)) !== null) {
    result += template.slice(lastIndex, match.index);

    if (match[1]) {
      const name = match[1];
      const value = params[name];
      if (value === undefined) {
        throw new Error(
          `RedwoodSDK: Missing parameter "${name}" for route ${template}. Ensure you're providing all required parameters in the params object.`,
        );
      }
      result += encodeURIComponent(value);
      consumed.add(name);
    } else {
      const key = `$${wildcardIndex}`;
      const value = params[key];
      if (value === undefined) {
        throw new Error(
          `RedwoodSDK: Missing parameter "${key}" for route ${template}. Wildcard routes use $0, $1, etc. as parameter keys.`,
        );
      }
      result += encodeWildcardValue(value);
      consumed.add(key);
      wildcardIndex += 1;
    }

    lastIndex = TOKEN_REGEX.lastIndex;
  }

  result += template.slice(lastIndex);

  for (const key of Object.keys(params)) {
    if (!consumed.has(key)) {
      throw new Error(
        `RedwoodSDK: Parameter "${key}" is not used by route ${template}. Check your params object for typos or remove unused parameters.`,
      );
    }
  }

  TOKEN_REGEX.lastIndex = 0;
  return result;
}

function encodeWildcardValue(value: string): string {
  return value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
