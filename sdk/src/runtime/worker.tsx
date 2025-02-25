import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { ErrorResponse } from "./error";

import { Route, RouteContext, defineRoutes } from "./lib/router";

declare global {
  type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
  }
}

export const defineApp = <Context,>(routes: Route<Context>[]) => {
  return {
    fetch: async (request: Request, env: Env, _ctx: ExecutionContext) => {
      globalThis.__webpack_require__ = ssrWebpackRequire;

      const router = defineRoutes(routes);

      // context(justinvdm, 5 Feb 2025): Serve assets requests using the assets service binding
      // todo(justinvdm, 5 Feb 2025): Find a way to avoid this so asset requests are served directly
      // rather than first needing to go through the worker
      if (request.url.includes("/assets/")) {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice("/assets/".length);
        return env.ASSETS.fetch(new Request(url.toString(), request));
      }

      try {
        const url = new URL(request.url);
        const isRSCRequest = url.searchParams.has("__rsc");

        const handleAction = async (ctx: RouteContext<Context, Record<string, string>>) => {
          const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

          if (isRSCActionHandler) {
            return await rscActionHandler(request, ctx); // maybe we should include params and ctx in the action handler?
          }
        }

        const renderPage = async ({
          Page,
          props,
          actionResult,
          Layout,
        }: {
          Page: React.FC<Record<string, any>>,
          props: Record<string, any>,
          actionResult: unknown,
          Layout: React.FC<{ children: React.ReactNode }>
        }) => {
          const rscPayloadStream = renderToRscStream({
            node: <Page {...props} />,
            actionResult: actionResult instanceof Response ? null : actionResult,
          });

          if (isRSCRequest) {
            return new Response(rscPayloadStream, {
              headers: {
                "content-type": "text/x-component; charset=utf-8",
              },
            });
          }

          const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();

          const htmlStream = await transformRscToHtmlStream({
            stream: rscPayloadStream1,
            Parent: Layout,
          });

          const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2))

          return new Response(html, {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        };

        const userHeaders = new Headers();

        const response = await router.handle({
          request,
          headers: userHeaders,
          ctx: {} as Context,
          env,
          rw: {
            Layout: DefaultLayout,
            handleAction,
            renderPage,
          },
        });

        for (const [key, value] of userHeaders.entries()) {
          if (!response.headers.has(key)) {
            response.headers.set(key, value);
          }
        }

        return response;
      } catch (e) {
        if (e instanceof ErrorResponse) {
          return new Response(e.message, { status: e.code });
        }

        console.error("Unhandled error", e);
        throw e;
      }
    }
  }
}

export const DefaultLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <script type="module" src="/src/client.tsx"></script>
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
