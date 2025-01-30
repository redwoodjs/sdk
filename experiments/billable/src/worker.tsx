import { App } from "./app/App";
import { db, setupDb } from "./db";

import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import InvoiceListPage from "./app/pages/InvoiceList/InvoiceListPage";
import InvoiceDetailPage from "./app/pages/InvoiceDetail/InvoiceDetailPage";
import { ErrorResponse } from "./error";
import { getSession, performLogin } from "./auth";
import { LoginPage } from "./app/pages/Login/LoginPage";
import { setupEnv } from "./env";
import HomePage from "./app/pages/Home/HomePage";

import { defineRoutes, index, prefix, route } from "./router";

export { SessionDO } from "./session";

export const getContext = async (
  session: Awaited<ReturnType<typeof getSession>> | undefined,
) => {
  const user = await db.user.findFirstOrThrow({
    where: { id: session?.userId },
  });
  return {
    user,
  };
};

// Update the PageComponent type definition

export default {
  async fetch(request: Request, env: Env) {
    globalThis.__webpack_require__ = ssrWebpackRequire;

    try {
      setupDb(env);
      setupEnv(env);

      // todo(justinvdm, 30 Jan 2025): Figure out how to avoid this.
      //
      // ## Context:
      // Vite sends an initial request to the worker when running the dev server,
      // at which point the Prisma WASM is imported. Using the Prisma for the first time _after_ this initial request
      // (e.g. if we only run the db for a request to /some/subpath) causes vite to not try import the WASM module
      // at all, and ultimately the request ends up hanging indefinetely.
      // * However, once the WASM has been imported, it is cached in some way that persists on the file system
      // (from experimentation, it is not in node_modules/.vite). This means that if you were to subsequently
      // change the code to _not_ have Prisma used after the initial request, the WASM will still be cached and
      // the request will not hang. This makes this issue particularly hard to debug.
      await db.$queryRaw`SELECT 1`

      const url = new URL(request.url);
      let ctx: Awaited<ReturnType<typeof getContext>> = {};
      let session: Awaited<ReturnType<typeof getSession>> | undefined;
      let authenticated: boolean = false;
      try {
        session = await getSession(request, env);
        ctx = await getContext(session);
        authenticated = true;
      } catch (e) {
        authenticated = false;
      }

      const isRSCRequest = url.searchParams.has("__rsc");
      const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

      let actionResult: any;
      if (isRSCActionHandler) {
        console.log("isRSCActionHandler", isRSCActionHandler);
        actionResult = await rscActionHandler(request, ctx);
        console.log("-".repeat(80));
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
          Parent: App,
        });

        const html = htmlStream.pipeThrough(
          injectRSCPayload(rscPayloadStream2),
        );
        return new Response(html, {
          headers: { "content-type": "text/html" },
        });
      };

      const r = defineRoutes(
        [
          index(HomePage),

          route("/login", LoginPage),
          route("/auth", async ({ request }) => {
            // when it's async then react-is thinks it's a react component.
            const url = new URL(request.url);
            const token = url.searchParams.get("token");
            const email = url.searchParams.get("email");

            if (!token || !email) {
              return new Response("Invalid token or email", { status: 400 });
            }
            const user = await db.user.findFirst({
              where: {
                email,
                authToken: token,
                authTokenExpiresAt: {
                  gt: new Date(),
                },
              },
            });

            if (!user) {
              return new Response("Invalid or expired token", { status: 400 });
            }

            // Clear the auth token
            await db.user.update({
              where: { id: user.id },
              data: {
                authToken: null,
                authTokenExpiresAt: null,
              },
            });

            console.log("performing login");

            return performLogin(request, env, user.id);
          }),

          route("/invoices", InvoiceListPage),

          ...prefix("/invoice", [
            route("/:id", InvoiceDetailPage), // can we type the params here?
            route("/:id/upload", async ({ request }) => {
            if (
              request.method === "POST" &&
              request.headers.get("content-type")?.includes("multipart/form-data")
            ) {
              // todo get userId from context.

              const formData = await request.formData();
              const userId = formData.get("userId") as string;
              const invoiceId = formData.get("invoiceId") as string;
              const file = formData.get("file") as File;

              // Stream the file directly to R2
              const r2ObjectKey = `/logos/${userId}/${invoiceId}-${Date.now()}-${file.name}`;
              await env.R2.put(r2ObjectKey, file.stream(), {
                httpMetadata: {
                  contentType: file.type,
                },
              });

              await db.invoice.update({
                where: { id: invoiceId },
                data: {
                  supplierLogo: r2ObjectKey,
                },
              });

              return new Response(JSON.stringify({ key: r2ObjectKey }), {
                status: 200,
                headers: {
                  "Content-Type": "application/json",
                },
              });
            }
              return new Response("Method not allowed", { status: 405 });
            }),
          ]),

          route("/logos/*", async (req) => {
            const object = await env.R2.get(url.pathname);
            if (object === null) {
              return new Response("Object Not Found", { status: 404 });
            }
            return new Response(object.body, {
              headers: {
                "Content-Type": object.httpMetadata?.contentType as string,
              },
            });
          }),
          route("/assets/*", ({ request }) => {
            const u = new URL(request.url);
            u.pathname = u.pathname.slice("/assets/".length);
            return env.ASSETS.fetch(new Request(u.toString(), request));
          }),
        ],
        {
          ctx,
          renderPage,
        },
      );

      return await r.handle(request);
    } catch (e) {
      if (e instanceof ErrorResponse) {
        return new Response(e.message, { status: e.code });
      }

      console.error("Unhandled error", e);
      throw e;
    }
  },
};
