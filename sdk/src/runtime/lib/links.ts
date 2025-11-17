import type {
  Route,
  RouteDefinition,
  RouteMiddleware,
} from "./router";

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

type ParamsForPath<Path extends string> = PathParams<Path> extends Record<
  string,
  never
>
  ? undefined
  : PathParams<Path>;

export type LinkFunction<Paths extends string> = {
  <Path extends Paths>(
    path: Path,
    params?: ParamsForPath<Path>,
  ): string;
};

type RoutePaths<Value> =
  Value extends RouteDefinition<infer Path, any>
    ? Path
    : Value extends readonly (infer Item)[]
      ? RouteArrayPaths<Value>
      : Value extends RouteMiddleware<any>
        ? never
        : never;

type RouteArrayPaths<Routes extends readonly any[]> = number extends Routes["length"]
  ? RoutePaths<Routes[number]>
  : Routes extends readonly [infer Head, ...infer Tail]
    ? RoutePaths<Head> | RouteArrayPaths<Tail>
    : never;

type AppRoutes<App> = App extends { __rwRoutes: infer Routes }
  ? Routes
  : never;

export type AppRoutePaths<App> = RoutePaths<AppRoutes<App>>;

export type AppLink<App> = LinkFunction<AppRoutePaths<App>>;

export function linkFor<App>(): AppLink<App> {
  return createLinkFunction<AppRoutePaths<App>>();
}

export function createLinks<App>(_app?: App): AppLink<App> {
  return linkFor<App>();
}

export function defineLinks<const T extends readonly string[]>(
  routes: T,
): LinkFunction<T[number]> {
  routes.forEach((route) => {
    if (typeof route !== "string") {
      throw new Error(`Invalid route: ${route}. Routes must be strings.`);
    }
  });

  const link = createLinkFunction<T[number]>();
  return ((path: T[number], params?: Record<string, string>) => {
    if (!routes.includes(path)) {
      throw new Error(`Invalid route: ${path}`);
    }
    return link(path, params as any);
  }) as LinkFunction<T[number]>;
}

const TOKEN_REGEX = /:([a-zA-Z0-9_]+)|\*/g;

function createLinkFunction<Paths extends string>(): LinkFunction<Paths> {
  return ((path: string, params?: Record<string, string>) => {
    const expectsParams = hasRouteParameters(path);

    if (!params || Object.keys(params).length === 0) {
      if (expectsParams) {
        throw new Error(`Route ${path} requires an object of parameters`);
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

function interpolate(
  template: string,
  params: Record<string, string>,
): string {
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
          `Missing parameter "${name}" for route ${template}`,
        );
      }
      result += encodeURIComponent(value);
      consumed.add(name);
    } else {
      const key = `$${wildcardIndex}`;
      const value = params[key];
      if (value === undefined) {
        throw new Error(
          `Missing parameter "${key}" for route ${template}`,
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
      throw new Error(`Parameter "${key}" is not used by route ${template}`);
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
