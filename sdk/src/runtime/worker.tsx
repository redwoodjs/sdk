import React from "react";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { renderToRscStream } from "./render/renderToRscStream";

import { rscActionHandler } from "./register/worker";
import { injectRSCPayload } from "rsc-html-stream/server";
import { ErrorResponse } from "./error";
import {
  getRequestInfo,
  runWithRequestInfo,
  runWithRequestInfoOverrides,
} from "./requestInfo/worker";
import { RequestInfo, DefaultAppContext } from "./requestInfo/types";

import { Route, type RwContext, defineRoutes } from "./lib/router";
import { generateNonce } from "./lib/utils";
import { ssrWebpackRequire } from "./imports/worker";

declare global {
  type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
  };
}
export const defineApp = <
  T extends RequestInfo = RequestInfo<any, DefaultAppContext>,
>(
  routes: Route<T>[],
) => {
  return {
    fetch: async (request: Request, env: Env, cf: ExecutionContext) => {
      globalThis.__webpack_require__ = ssrWebpackRequire;

      const router = defineRoutes<T>(routes);

      // context(justinvdm, 5 Feb 2025): Serve assets requests using the assets service binding
      // todo(justinvdm, 5 Feb 2025): Find a way to avoid this so asset requests are served directly
      // rather than first needing to go through the worker
      if (request.url.includes("/assets/")) {
        const url = new URL(request.url);
        url.pathname = url.pathname.slice("/assets/".length);
        return env.ASSETS.fetch(new Request(url.toString(), request));
      } else if (
        import.meta.env.VITE_IS_DEV_SERVER &&
        request.url.includes("/__vite_preamble__")
      ) {
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
        const isRSCRequest =
          url.searchParams.has("__rsc") ||
          request.headers.get("accept")?.includes("text/x-component");
        const isSmokeTest = url.searchParams.has("__smoke_test");
        const userHeaders = new Headers();
        let deferredPageResolved: PromiseWithResolvers<void> | undefined;

        const rw: RwContext = {
          Document: DefaultDocument,
          nonce: generateNonce(),
          rscPayload: true,
          ssr: true,
          databases: new Map(),
          scriptsToBeLoaded: new Set(),
        };

        const outerRequestInfo: RequestInfo<any, T["ctx"]> = {
          request,
          headers: userHeaders,
          cf,
          params: {},
          ctx: {},
          rw,
        };

        const createPageElement = (
          requestInfo: RequestInfo<any, T["ctx"]>,
          Page: React.FC<any>,
        ) => {
          let pageElement;
          if (isClientReference(Page)) {
            const { ctx, params } = requestInfo; // context(justinvdm, 25 Feb 2025): If the page is a client reference, we need to avoid passing
            // down props the client shouldn't get (e.g. env). For safety, we pick the allowed props explicitly.
            pageElement = <Page ctx={ctx} params={params} />;
          } else {
            // context(justinvdm, 24 Apr 2025): We need to wrap the page in a component that throws the response to bubble it up and break out of react rendering context
            // This way, we're able to return a response from the page component while still staying within react rendering context
            const PageWrapper = async () => {
              const result = await Page(requestInfo);

              if (result instanceof Response) {
                deferredPageResolved?.reject(result);
                throw result;
              }

              deferredPageResolved?.resolve();
              return result;
            };

            deferredPageResolved = Promise.withResolvers();
            pageElement = <PageWrapper />;
          }

          if (isSmokeTest) {
            pageElement = <SmokeTestWrapper>{pageElement}</SmokeTestWrapper>;
          }

          return pageElement;
        };

        const renderPage = async (
          requestInfo: RequestInfo<T>,
          Page: React.FC<any>,
          onError: (error: unknown) => void,
        ) => {
          if (isClientReference(requestInfo.rw.Document)) {
            if (import.meta.env.DEV) {
              console.error("Document cannot be a client component");
            }

            return new Response(null, {
              status: 500,
            });
          }

          let actionResult: unknown = undefined;
          const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

          if (isRSCActionHandler) {
            actionResult = await rscActionHandler(request);
          }

          const pageElement = createPageElement(requestInfo, Page);

          const { rscPayload: shouldInjectRSCPayload } = rw;

          let rscPayloadStream = renderToRscStream({
            node: pageElement,
            actionResult:
              actionResult instanceof Response ? null : actionResult,
            onError,
          });

          if (isRSCRequest) {
            return new Response(rscPayloadStream, {
              headers: {
                "content-type": "text/x-component; charset=utf-8",
              },
            });
          }

          let injectRSCPayloadStream: TransformStream<any, any> | undefined;

          if (shouldInjectRSCPayload) {
            const [rscPayloadStream1, rscPayloadStream2] =
              rscPayloadStream.tee();

            rscPayloadStream = rscPayloadStream1;

            injectRSCPayloadStream = injectRSCPayload(rscPayloadStream2, {
              nonce: rw.nonce,
            });
          }

          let html: ReadableStream<any> = await transformRscToHtmlStream({
            stream: rscPayloadStream,
            Document: rw.Document,
            requestInfo: requestInfo,
            onError,
          });

          if (injectRSCPayloadStream) {
            html = html.pipeThrough(injectRSCPayloadStream);
          }

          return new Response(html, {
            headers: {
              "content-type": "text/html; charset=utf-8",
            },
          });
        };

        const response = await runWithRequestInfo(
          outerRequestInfo,
          async () =>
            new Promise<Response>(async (resolve, reject) => {
              try {
                resolve(
                  await router.handle({
                    request,
                    renderPage,
                    getRequestInfo: getRequestInfo as () => T,
                    runWithRequestInfoOverrides,
                    onError: reject,
                  }),
                );
              } catch (e) {
                reject(e);
              }
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

        await deferredPageResolved?.promise;
        return mutableResponse;
      } catch (e) {
        if (e instanceof ErrorResponse) {
          return new Response(e.message, { status: e.code });
        }

        if (e instanceof Response) {
          return e;
        }

        console.error("Unhandled error", e);
        throw e;
      }
    },
  };
};

export const SmokeTestWrapper: React.FC<{
  children: React.ReactNode;
}> = async ({ children }) => {
  const smokeTestInfo = await Object.values(
    await (
      import.meta as any as {
        glob: (path: string) => Promise<Record<string, () => Promise<any>>>;
      }
    ).glob("/src/app/components/__SmokeTest.tsx"),
  )[0]();

  const SmokeTestInfo = smokeTestInfo.SmokeTestInfo as React.FC<any>;

  return (
    <>
      <SmokeTestInfo />
      {children}
    </>
  );
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

const isClientReference = (Component: React.FC<any>) => {
  return Object.prototype.hasOwnProperty.call(Component, "$$isClientReference");
};
