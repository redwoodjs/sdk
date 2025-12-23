# Router Architecture

The router is responsible for processing incoming requests by matching the request path against a set of defined routes and executing the associated handlers (middleware, page components, or API handlers).

## Core Principles

### 1. Sequential, Short-Circuiting Evaluation

The router iterates through a flattened list of route definitions in the order they were defined. The first route that matches the request path and method "wins," and its handler is executed. Once a response is generated (either by a middleware or a final route handler), the process stops.

### 2. Flattened Route Table

Even though routes can be defined using nested structures (via `prefix` or `layout`), the router flattens these into a single, linear array during initialization. This simplifies the request processing loop to a single pass.

### 3. Unified Request Handling

The same routing logic applies to all request types, including full page loads, RSC (React Server Component) actions, and API requests. This ensures consistent application of middleware (e.g., for authentication or logging).

## Key Components & APIs

### `defineRoutes`

The entry point for creating a router instance. it takes an array of `Route` objects and returns a `handle` function.

### `route(path, handler)`

Defines a specific path pattern and its handler.

- **Static paths**: `/about`
- **Parameters**: `/users/:id`
- **Wildcards**: `/files/*`

### `prefix(path, routes)`

Groups a set of routes under a common path prefix. This is handled during the flattening process by prepending the prefix to each nested route's path.

### `layout(Component, routes)`

Wraps a set of routes with a shared React layout component. During flattening, the layout is added to the `layouts` array of each nested route.

### `matchPath(routePath, requestPath)`

The core pattern matching engine. It converts route patterns into regular expressions to:

1. Determine if a request matches.
2. Extract named parameters (e.g., `id`) and wildcards (`$0`, `$1`).

## Performance Characteristics

Based on our benchmarking of the optimized implementation, the router has the following performance profile:

### Hotspots: O(n) Linear Scans

The primary performance bottleneck remains the linear scan through the flattened route table, but its constant factor has been significantly reduced via caching and pre-compilation.

- **Performance scales with route count**: 100 routes now typically take on the order of 3–6μs to scan, while 200 routes are ~5–6μs on our reference hardware (measured via `sdk/src/runtime/lib/router.bench.ts`).
- **Worst-case**: A "404 Not Found" result (no route matches) still requires checking every route, but is now roughly an order of magnitude faster than the original implementation.

### What is Efficient

- **Prefixing & Nesting**: Deeply nested prefixes (10+ levels) have negligible impact on matching speed once flattened.
- **Layout Wrapping**: Adding multiple layouts adds minimal overhead (~1μs for 5 layouts).
- **Middleware**: A handful of global or route-specific middlewares are very efficient.
- **Path Matching**: The combination of path normalization, `matchPath` pre-compilation, and regex caching yields tens of millions of matches per second in micro-benchmarks, so individual path matches are effectively “free” compared to the cost of scanning many routes.

## Optimization Guardrails

When modifying the router, the following guardrails should be observed:

1. **Protect the Fast Path**: Common cases (first few routes matching) should remain in the 4-5μs range.
2. **Prioritize Algorithmic Wins**: Optimization efforts should focus on reducing the number of routes that need to be scanned (e.g., via prefix bucketing or indexing) rather than further micro-optimizing the already-cached `matchPath` internals.
3. **Preserve Ordering**: The strictly left-to-right evaluation order must be maintained to ensure predictable middleware and route precedence.

For detailed benchmarking instructions and regression testing, see [Router Performance Benchmarks](./router-performance.md).

