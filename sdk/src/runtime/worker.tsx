import React from "react";
import { normalizeActionResult } from "./render/normalizeActionResult";
import { renderDocumentHtmlStream } from "./render/renderDocumentHtmlStream";
import { renderToRscStream } from "./render/renderToRscStream";

import { injectRSCPayload } from "rsc-html-stream/server";
import { ErrorResponse } from "./error";
import { rscActionHandler } from "./register/worker";
import { DefaultAppContext, RequestInfo } from "./requestInfo/types";
import {
  getRequestInfo,
  runWithRequestInfo,
  runWithRequestInfoOverrides,
} from "./requestInfo/worker";

import { ssrWebpackRequire } from "./imports/worker";
import { Route, defineRoutes } from "./lib/router";
import type { RwContext } from "./lib/types.js";
import { generateNonce } from "./lib/utils";

export * from "./requestInfo/types";

declare global {
  type Env = {
    ASSETS: Fetcher;
    DB: D1Database;
  };
}
export type AppDefinition<
  Routes extends readonly Route<any>[],
  T extends RequestInfo,
> = {
  fetch: (
    request: Request,
    env: Env,
    cf: ExecutionContext,
  ) => Promise<Response>;
  __rwRoutes: Routes;
};

export const defineApp = <
  T extends RequestInfo = RequestInfo<any, DefaultAppContext>,
  Routes extends readonly Route<T>[] = readonly Route<T>[],
>(
  routes: Routes,
): AppDefinition<Routes, T> => {
  return {
    __rwRoutes: routes,
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
        new URL(request.url).pathname === "/__worker-run"
      ) {
        const expectedToken = (import.meta.env as any)
          .VITE_RWSDK_WORKER_RUN_TOKEN;
        const requestToken = request.headers.get("x-rwsdk-worker-run-token");

        if (!expectedToken || expectedToken !== requestToken) {
          return new Response("Forbidden", { status: 403 });
        }

        const url = new URL(request.url);
        const scriptPath = url.searchParams.get("script");

        if (!scriptPath) {
          return new Response("Missing 'script' query parameter", {
            status: 400,
          });
        }

        try {
          const scriptModule = await import(/* @vite-ignore */ scriptPath);
          if (scriptModule.default) {
            await scriptModule.default(request, env, cf);
          }
          return new Response("Script executed successfully");
        } catch (e: any) {
          console.error(`Error executing script: ${scriptPath}\n\n${e.stack}`);
          return new Response(`Error executing script: ${e.message}`, {
            status: 500,
          });
        }
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
        const isAction = url.searchParams.has("__rsc_action_id");

        const rw: RwContext = {
          Document: DefaultDocument,
          nonce: generateNonce(),
          rscPayload: true,
          ssr: true,
          databases: new Map(),
          scriptsToBeLoaded: new Set(),
          entryScripts: new Set(),
          inlineScripts: new Set(),
          pageRouteResolved: undefined,
        };

        const userResponseInit: ResponseInit & { headers: Headers } = {
          status: 200,
          headers: new Headers(),
        };

        const outerRequestInfo: RequestInfo<any, T["ctx"]> = {
          request,
          cf,
          params: {},
          ctx: {},
          rw,
          response: userResponseInit,
          isAction,
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
            pageElement = <Page {...requestInfo} />;
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

          const actionResult = normalizeActionResult(
            requestInfo.rw.actionResult,
          );

          const pageElement = createPageElement(requestInfo, Page);

          const { rscPayload: shouldInjectRSCPayload } = rw;

          let rscPayloadStream = renderToRscStream({
            input: {
              node: pageElement,
              actionResult,
            },
            onError,
          });

          if (isRSCRequest) {
            const responseHeaders = new Headers(userResponseInit.headers);
            responseHeaders.set(
              "content-type",
              "text/x-component; charset=utf-8",
            );

            return new Response(rscPayloadStream, {
              status: userResponseInit.status,
              statusText: userResponseInit.statusText,
              headers: responseHeaders,
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

          let html: ReadableStream<any> = await renderDocumentHtmlStream({
            rscPayloadStream: rscPayloadStream,
            Document: rw.Document,
            requestInfo: requestInfo,
            onError,
            shouldSSR: rw.ssr,
          });

          if (injectRSCPayloadStream) {
            html = html.pipeThrough(injectRSCPayloadStream);
          }

          const responseHeaders = new Headers(userResponseInit.headers);
          responseHeaders.set("content-type", "text/html; charset=utf-8");

          return new Response(html, {
            status: userResponseInit.status,
            statusText: userResponseInit.statusText,
            headers: responseHeaders,
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
                    rscActionHandler,
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

        // Merge headers from user response init (these take precedence)
        if (userResponseInit.headers) {
          const userResponseHeaders = new Headers(userResponseInit.headers);
          for (const [key, value] of userResponseHeaders.entries()) {
            if (!response.headers.has(key)) {
              mutableResponse.headers.set(key, value);
            }
          }
        }

        await rw.pageRouteResolved?.promise;
        return mutableResponse;
      } catch (e) {
        if (e instanceof ErrorResponse) {
          return new Response(e.message, { status: e.code });
        }

        if (e instanceof Response) {
          const status = e.status;
          const locationHeader =
            e.headers.get("Location") || e.headers.get("location");
          if (status >= 300 && status < 400 && locationHeader) {
            try {
              const absolute = new URL(locationHeader, request.url).toString();
              const headers = new Headers(e.headers);
              headers.set("x-rwsdk-redirect-location", absolute);
              return new Response(e.body, {
                status: e.status,
                statusText: e.statusText,
                headers,
              });
            } catch {
              // fall through to return original response
            }
          }
          return e;
        }
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

const isClientReference = (Component: React.FC<any>) => {
  return Object.prototype.hasOwnProperty.call(Component, "$$isClientReference");
};
