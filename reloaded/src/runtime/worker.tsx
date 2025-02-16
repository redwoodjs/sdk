import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { ErrorResponse } from "./error";

import { RouteDefinition, defineRoutes } from "./lib/router";

declare global {
  type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
  }
}


type DefineAppOptions<Context> = {
  setup?: (env: Env) => void | Promise<void>;
  routes: RouteDefinition[];
  getContext: (request: Request, env: Env) => Context | Promise<Context>;
  Document: React.FC<{ children: React.ReactNode }>;
}

export const defineApp = <Context,>(options: DefineAppOptions<Context>) => {
  const { getContext, routes, Document, setup } = options;

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
        await setup?.(env);

        const url = new URL(request.url);

        const ctx = await getContext(request, env);

        const isRSCRequest = url.searchParams.has("__rsc");
        const isRSCActionHandler = url.searchParams.has("__rsc_action_id");
        let actionResult: any;
        if (isRSCActionHandler) {
          actionResult = await rscActionHandler(request, ctx, env); // maybe we should include params and ctx in the action handler?
        }

        const renderPage = async (Page: any, props = {}) => {
          const rscPayloadStream = renderToRscStream({
            node: <Page {...props} />,
            actionResult: actionResult,
          });
          if (isRSCRequest) {
            return new Response(rscPayloadStream, {
              headers: { "content-type": "text/x-component; charset=utf-8" },
            });
          }
          const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();

          const htmlStream = await transformRscToHtmlStream({
            stream: rscPayloadStream1,
            Parent: Document,
          });

          const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2))

          return new Response(html, {
            headers: { "content-type": "text/html" },
          });
        };

        const response = await router.handle({
          request,
          ctx,
          env,
          renderPage,
        });

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