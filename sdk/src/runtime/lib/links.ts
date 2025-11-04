// Type that parses a route string into parameter types
type ParseRoute<T extends string> =
  T extends `${infer Start}:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ParseRoute<Rest>
    : T extends `${infer Start}:${infer Param}`
      ? { [K in Param]: string }
      : T extends `${infer Start}*${infer Rest}`
        ? { $0: string } & ParseRoute<Rest>
        : T extends `${infer Start}*`
          ? { $0: string }
          : {};

// Helper type to count stars in a string
type CountStars<T extends string> = T extends `${infer Start}*${infer Rest}`
  ? { $0: string } & ShiftIndices<CountStars<Rest>>
  : {};

// Helper type to shift indices
type ShiftIndices<T> = T extends { [K in `$${infer N}`]: string }
  ? { [K in `$${AddOne<N>}`]: string }
  : {};

// Helper type to add one to a number string
type AddOne<T extends string> = T extends "0"
  ? "1"
  : T extends "1"
    ? "2"
    : T extends "2"
      ? "3"
      : T extends "3"
        ? "4"
        : T extends "4"
          ? "5"
          : never;

// Extracts all possible parameters from an array of routes
type ExtractParams<T extends string[]> = {
  [K in T[number]]: ParseRoute<K>;
}[T[number]];

// The link function type with proper type checking
type LinkFunction<T extends readonly string[]> = {
  <Path extends T[number]>(
    path: Path,
    params?: ParseRoute<Path> extends Record<string, never>
      ? undefined
      : ParseRoute<Path>,
  ): string;
};

/**
 * Creates a type-safe link generation function from route patterns.
 *
 * @example
 * // Define your routes
 * const link = defineLinks([
 *   "/",
 *   "/about",
 *   "/users/:id",
 *   "/files/*",
 * ] as const)
 *
 * // Generate links with type checking
 * link("/")                                  // "/"
 * link("/about")                             // "/about"
 * link("/users/:id", { id: "123" })          // "/users/123"
 * link("/files/*", { $0: "docs/guide.pdf" }) // "/files/docs/guide.pdf"
 */
export function defineLinks<const T extends readonly string[]>(
  routes: T,
): LinkFunction<T> {
  // Validate routes at runtime
  routes.forEach((route) => {
    if (typeof route !== "string") {
      throw new Error(`Invalid route: ${route}. Routes must be strings.`);
    }
  });

  return (path: T[number], params?: Record<string, string>): string => {
    if (!routes.includes(path)) {
      throw new Error(`Invalid route: ${path}`);
    }

    if (!params) return path;

    let result = path;

    // Replace named parameters
    for (const [key, value] of Object.entries(params)) {
      if (key.startsWith("$")) {
        // Replace each star with its corresponding $ parameter
        const starIndex = parseInt(key.slice(1));
        const stars = result.match(/\*/g) || [];
        if (starIndex >= stars.length) {
          throw new Error(`Parameter ${key} has no corresponding * in route`);
        }
        // Replace the nth star with the value
        let count = 0;
        result = result.replace(/\*/g, (match) =>
          count++ === starIndex ? value : match,
        );
      } else {
        // Handle named parameters
        if (typeof value !== "string") {
          throw new Error(`Parameter ${key} must be a string`);
        }
        result = result.replace(`:${key}`, value);
      }
    }

    return result;
  };
}
