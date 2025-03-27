import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "./render/injectRSCPayload";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { ErrorResponse } from "./error";

import {
  Route,
  RouteOptions,
  defineRoutes,
  RenderPageParams,
  PageProps,
  DocumentProps,
} from "./lib/router";
import { generateNonce } from "./lib/utils";
import { IS_DEV } from "./constants";

declare global {
  type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
  };
}

export const defineApp = <Context,>(routes: Route<Context>[]) => {
  return {
    fetch: async (request: Request, env: Env, cf: ExecutionContext) => {
      globalThis.__webpack_require__ = ssrWebpackRequire;

      const router = defineRoutes(routes);

      // context(justinvdm, 5 Feb 2025): Serve assets requests using the assets service binding
      // todo(justinvdm, 5 Feb 2025): Find a way to avoid this so asset requests are served directly
      // rather than first needing to go through the worker
      if (request.url.includes("/assets/")) {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice("/assets/".length);
        return env.ASSETS.fetch(new Request(url.toString(), request));
      } else if (IS_DEV && request.url.includes("/__vite_preamble__")) {
        return new Response(
          'import RefreshRuntime from "/@react-refresh"; RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => (type) => type; window.__vite_plugin_react_preamble_installed__ = true;',
          {
            headers: {
              "content-type": "text/javascript",
            },
          },
        );
      }

      try {
        const url = new URL(request.url);
        const isRSCRequest = url.searchParams.has("__rsc");

        const handleAction = async (
          opts: RouteOptions<Context, Record<string, string>>,
        ) => {
          const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

          if (isRSCActionHandler) {
            return await rscActionHandler(request, opts); // maybe we should include params and ctx in the action handler?
          }
        };

        const renderPage = async ({
          Page,
          props: fullPageProps,
          actionResult,
          Document,
        }: RenderPageParams<Context>) => {
          let props = fullPageProps;
          let documentProps = fullPageProps;

          // context(justinvdm, 25 Feb 2025): If the page is a client reference, we need to avoid passing
          // down props the client shouldn't get (e.g. env). For safety, we pick the allowed props explicitly.
          if (
            Object.prototype.hasOwnProperty.call(Page, "$$isClientReference")
          ) {
            const { ctx, params } = fullPageProps;
            props = { ctx, params } as PageProps<Context>;
          }

          if (
            Object.prototype.hasOwnProperty.call(
              Document,
              "$$isClientReference",
            )
          ) {
            const { ctx, params } = fullPageProps;
            documentProps = { ctx, params } as DocumentProps<Context>;
          }

          const nonce = fullPageProps.rw.nonce;

          const rscPayloadStream = renderToRscStream({
            node: <Page {...props} />,
            actionResult:
              actionResult instanceof Response ? null : actionResult,
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
            Parent: ({ children }) => (
              <Document {...documentProps} children={children} />
            ),
          });

          const html = htmlStream.pipeThrough(
            injectRSCPayload(rscPayloadStream2, { nonce }),
          );

          return new Response(html, {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        };

        const userHeaders = new Headers();

        const response = await router.handle({
          cf,
          request,
          headers: userHeaders,
          ctx: {} as Context,
          env,
          rw: {
            Document: DefaultDocument,
            handleAction,
            renderPage,
            nonce: generateNonce(),
          },
        });

        // context(justinvdm, 18 Mar 2025): In some cases, such as a .fetch() call to a durable object instance, or Response.redirect(),
        // we need to return a mutable response object.
        const mutableResponse = new Response(response.body, response);

        for (const [key, value] of userHeaders.entries()) {
          if (!response.headers.has(key)) {
            mutableResponse.headers.set(key, value);
          }
        }

        return mutableResponse;
      } catch (e) {
        if (e instanceof ErrorResponse) {
          return new Response(e.message, { status: e.code });
        }

        console.error("Unhandled error", e);
        throw e;
      }
    },
  };
};

export const DefaultDocument: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
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
