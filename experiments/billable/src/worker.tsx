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

// todo(peterp, 2024-11-25): Make these lazy.
const routes = {
  "/": HomePage,
  "/invoices": InvoiceListPage,
  "/invoice/:id": InvoiceDetailPage,
  "/login": LoginPage,
};

export { SessionDO } from "./session";

export default {
  async fetch(request: Request, env: Env) {
    globalThis.__webpack_require__ = ssrWebpackRequire;

    try {
      const url = new URL(request.url);

      //Determine if the user is or was authenticated.
      let session: Awaited<ReturnType<typeof getSession>> | undefined;
      let authenticated: boolean = false;
      try {
        session = await getSession(request, env);
        authenticated = true;
      } catch (e) {
        authenticated = false;
      }

      const isRSCRequest = url.searchParams.has("__rsc");
      const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

      let actionResult: any;
      if (isRSCActionHandler) {
        actionResult = await rscActionHandler(request);
      }

      if (url.pathname.startsWith("/assets/")) {
        url.pathname = url.pathname.slice("/assets/".length);
        return env.ASSETS.fetch(new Request(url.toString(), request));
      }

      setupDb(env);
      setupEnv(env);

      // grab the image if it's requested.
      if (request.method === "GET" && url.pathname.startsWith("/logos/")) {
        const object = await env.R2.get(url.pathname);
        if (object === null) {
          return new Response("Object Not Found", { status: 404 });
        }
        return new Response(object.body, {
          headers: {
            "Content-Type": object.httpMetadata?.contentType as string,
          },
        });
      }

      if (url.pathname === "/auth" && request.method === "GET") {
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

        return performLogin(request, env, user.id);
      }
      // add logout.

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

      const pathname = new URL(request.url).pathname as keyof typeof routes;
      const Page = routes[pathname];
      if (pathname === "/" || pathname === "/login") {
        return renderPage(Page);
      }


      if (!authenticated) {
        // @ts-ignore TypeScript thinks this is wrong.
        if (pathname === "/") {
          return new Response("Redirecting to /invoices", {
            status: 302,
            headers: {
              Location: "/invoices",
            },
          });
        }

        if (Page) {
          return renderPage(Page);
        }

        if (pathname.startsWith("/invoice/")) {
          const id = pathname.slice("/invoice/".length);
          if (pathname.endsWith("/upload")) {
            if (
              request.method === "POST" &&
              request.headers
                .get("content-type")
                ?.includes("multipart/form-data")
            ) {
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
          } else {
            return renderPage(InvoiceDetailPage, { id });
          }
        }
      }

      if (!Page) {
        return new Response("Not found", { status: 404 });
      }
    } catch (e) {
      if (e instanceof ErrorResponse) {
        return new Response(e.message, { status: e.code });
      }

      console.error("Unhandled error", e);
      throw e;
    }
  },
};
