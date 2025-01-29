import { isValidElementType } from "react-is";


type RouteHandler = (
  request: Request,
  opts: any,
  // define "next" here...
) => Response | Promise<Response>;

// todo (peterp, 2025-01-29): Figure out if params is the right thing to do here,
// maybe we just spread them out instead?
// Might make the page component feel a bit more idiomatic.
export type AsyncPageComponent = (props: { params: any, ctx: any }) => Promise<JSX.Element>;
export type PageComponent = (props: { params: any, ctx: any }) => JSX.Element;

type RouteDefinition = {
  path: string;
  handler:
    | RouteHandler
    | PageComponent
    | AsyncPageComponent
    | Promise<{ default: PageComponent }>
};

type RouteMatch = {
  params: Record<string, string>;
  handler: RouteDefinition["handler"];
};

type RouterInstance = {
  routes: RouteDefinition[];
  handle: (request: Request) => Promise<Response>;
};

/**
 * Matches a URL path against a route path pattern
 */
function matchPath(routePath: string, requestPath: string): Record<string, string> | null {
  // Convert route path to regex pattern
  const pattern = routePath
    .replace(/:[a-zA-Z]+/g, "([^/]+)") // Convert :param to capture group
    .replace(/\*/g, "(.*)"); // Convert * to wildcard capture group

  const regex = new RegExp(`^${pattern}$`);
  const matches = requestPath.match(regex);

  if (!matches) {
    return null;
  }

  // Extract named parameters and wildcards
  const params: Record<string, string> = {};
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

/**
 * Defines the application routes
 */
// todo: (peterp, 2025-01-28): The user must be able to register a context handler for each request, but
// this might actually happen outside of this, so we can simply pass in the context object for each request.
export function defineRoutes(
  routes: RouteDefinition[],
  { ctx, renderPage }: { ctx: any, renderPage: (page: any, props: Record<string, any>) => Promise<Response>},
): RouterInstance {
  return {
    routes,
    async handle(request: Request) {
      const url = new URL(request.url);
      const path = url.pathname;

      // Find matching route
      let match: RouteMatch | null = null;
      for (const route of routes) {
        const params = matchPath(route.path, path);
        if (params) {
          match = { params, handler: route.handler };
          console.log('[debug] route matched ', route.path)
          break;
        }
      }



      if (!match) {
        // todo(peterp, 2025-01-28): Allow the user to define the own not found route.
        return new Response("Not Found", { status: 404 });
      }

      const { params, handler } = match;

      // Handle array of handlers (middleware chain)
      if (Array.isArray(handler)) {
        // todo: fix this later.
        // let response: Response | undefined
        // let currentIndex = 0

        // const next = async () => {
        //   const currentHandler = handler[currentIndex]
        //   currentIndex++

        //   if (!currentHandler) {
        //     return response
        //   }

        //   if (typeof currentHandler === 'function') {
        //     if ('$$typeof' in currentHandler) {
        //       // Page component
        //       return new Response(
        //         `<div id="root">${await renderToString(
        //           currentHandler({ params })
        //         )}</div>`,
        //         {
        //           headers: { 'Content-Type': 'text/html' },
        //         }
        //       )
        //     } else {
        //       // Route handler
        //       return currentHandler(request, response!, next)
        //     }
        //   }

        //   // Handle async imports
        //   const mod = await currentHandler
        //   // return new Response(
        //   //   `<div id="root">${await renderToString(
        //   //     mod.default({ params })
        //   //   )}</div>`,
        //   //   {
        //   //     headers: { 'Content-Type': 'text/html' },
        //   //   }
        //   // )
        // }

        // return next()
        return new Response("not implemented...");
      } else if (typeof handler === "function") {
        // note(peterp, 2025-12-29): I am not sure how to accurately determine if a function is a react function.
        // I get a false positive for an async function, and am using this latter check to figure this out.
        if (isValidElementType(handler) && handler.toString().includes('jsx')) {
          console.log('[debug] rendering react component')
          return await renderPage(handler, { ctx });
        } else {
          // Route handler
          console.log('[debug] request handler')
          return handler(request, { params }) as Response;
        }
      }
      return new Response('handler not implemented.')
    },
  };
}

/**
 * Creates a route definition for a specific path
 */
export function route(
  path: string,
  handler:
    | RouteHandler
    | PageComponent
    | Promise<{ default: PageComponent }>
    | Array<RouteHandler | PageComponent | Promise<{ default: PageComponent }>>,
): RouteDefinition {
  return {
    path,
    handler,
  };
}

/**
 * Creates a route definition for the index path ('/')
 */
export function index(
  handler: RouteHandler | PageComponent | Promise<{ default: PageComponent }>,
): RouteDefinition {
  return route("/", handler);
}

// We might have to abstract "response" since it's not mutable as far as I know.
