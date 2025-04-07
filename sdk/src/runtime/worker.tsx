import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "./render/injectRSCPayload";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { ErrorResponse } from "./error";
import {
  RequestContext,
  getRequestContext,
  runWithRequestContext,
} from "./requestContext/worker";

import { Route, defineRoutes } from "./lib/router";
import { generateNonce } from "./lib/utils";
import { IS_DEV } from "./constants";

declare global {
  type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
  };
}

export const defineApp = <Data,>(routes: Route<Data>[]) => {
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
        const userHeaders = new Headers();

        const rw = {
          Document: DefaultDocument,
          nonce: generateNonce(),
        };

        const outerRequestContext: RequestContext<Data> = {
          request,
          headers: userHeaders,
          cf,
          params: {},
          data: {} as Data,
          rw,
        };

        const computeDeprecatedPageProps = (Page: React.FC) => {
          const requestContext = getRequestContext();

          const routeOptions = {
            cf,
            request,
            env,
            appContext: requestContext.data,
            headers: requestContext.headers,
            params: requestContext.params,
            rw,
          };

          let props = routeOptions;
          let fullPageProps = routeOptions;

          let documentProps: any = {
            appContext: routeOptions.appContext,
            params: routeOptions.params,
            rw: routeOptions.rw,
          };

          // context(justinvdm, 25 Feb 2025): If the page is a client reference, we need to avoid passing
          // down props the client shouldn't get (e.g. env). For safety, we pick the allowed props explicitly.
          if (
            Object.prototype.hasOwnProperty.call(Page, "$$isClientReference")
          ) {
            const { appContext, params } = fullPageProps;
            // context(justinvdm, 6 Apr 2025): tsignore instead of cast to avoid importing deprecated types
            // @ts-ignore
            props = { appContext, params };
          }

          if (
            Object.prototype.hasOwnProperty.call(
              rw.Document,
              "$$isClientReference",
            )
          ) {
            const { appContext, params } = fullPageProps;
            documentProps = { appContext, params };
          }

          return { routeOptions, props, documentProps };
        };

        const renderPage = async (Page: React.FC<any>) => {
          let actionResult: unknown = undefined;
          const isRSCActionHandler = url.searchParams.has("__rsc_action_id");
          const deprecatedPageProps = computeDeprecatedPageProps(Page);

          if (isRSCActionHandler) {
            actionResult = await rscActionHandler(
              request,
              deprecatedPageProps.routeOptions,
            );
          }

          const rscPayloadStream = renderToRscStream({
            node: <Page {...deprecatedPageProps.props} />,
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
              <rw.Document
                {...deprecatedPageProps.documentProps}
                children={children}
              />
            ),
          });

          const html = htmlStream.pipeThrough(
            injectRSCPayload(rscPayloadStream2, {
              nonce: rw.nonce,
            }),
          );

          return new Response(html, {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        };

        const response = await runWithRequestContext(outerRequestContext, () =>
          router.handle({
            request,
            renderPage,
            deprecatedRouteOptions: {
              cf,
              request,
              env,
              appContext: outerRequestContext.data,
              headers: outerRequestContext.headers,
              params: outerRequestContext.params,
              rw: outerRequestContext.rw,
            },
          }),
        );

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
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
