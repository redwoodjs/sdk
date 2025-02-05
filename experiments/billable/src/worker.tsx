import { App } from "./app/App";
import { db, setupDb } from "./db";

import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";

import { ssrWebpackRequire } from "./imports/worker";
import { rscActionHandler } from "./register/worker";
import { ErrorResponse } from "./error";
import { getSession } from "./auth";
import { setupEnv } from "./env";
import HomePage from "./app/pages/Home/HomePage";

import { defineRoutes, index, prefix } from "./lib/router";
import { authRoutes } from "./app/pages/auth/routes";
import { invoiceRoutes } from "./app/pages/invoice/routes";
import { link } from "src/shared/links";

export { SessionDO } from "./session";

export const getContext = async (
  session: Awaited<ReturnType<typeof getSession>> | undefined,
) => {
  const user = await db.user.findFirstOrThrow({
    select: {
      id: true,
      email: true,
    },
    where: { id: session?.userId },
  });
  return {
    user,
  };
};

function authRequired({ ctx }: any) {
  if (!ctx.user) {
    return new Response("Unauthorized", { status: 401 });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    globalThis.__webpack_require__ = ssrWebpackRequire;

    const router = defineRoutes([
      index([
        function ({ ctx }) {
          if (ctx.user) {
            return new Response(null, {
              status: 302,
              headers: { Location: link('/invoice/list') },
            });
          }
        },
        HomePage,
      ]),
      ...prefix("/user", authRoutes),
      ...prefix("/invoice", invoiceRoutes),
    ]);

    // I don't thin I actually use this, but maybe we should upload a logo or something?
    //   route("/assets/*", ({ request, env }) => {
    //     const u = new URL(request.url);
    //     u.pathname = u.pathname.slice("/assets/".length);
    //     return env.ASSETS.fetch(new Request(u.toString(), request));
    //   }),
    // ]);

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
      await db.$queryRaw`SELECT 1`;

      const url = new URL(request.url);

      if (url.pathname === '/test/db') {
        console.log('## test db')
        const r = await db.$queryRaw`SELECT 1`
        console.log('## test db result', r)
        return new Response(JSON.stringify(r), { status: 200 })
      }

      let ctx: Awaited<ReturnType<typeof getContext>> = {};
      let session: Awaited<ReturnType<typeof getSession>> | undefined;
      try {
        session = await getSession(request, env);
        ctx = await getContext(session);
      } catch (e) {
        console.error("Error getting session", e);
      }

      const isRSCRequest = url.searchParams.has("__rsc");
      const isRSCActionHandler = url.searchParams.has("__rsc_action_id");
      let actionResult: any;
      if (isRSCActionHandler) {
        actionResult = await rscActionHandler(request, ctx); // maybe we should include params and ctx in the action handler?
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
  },
};
