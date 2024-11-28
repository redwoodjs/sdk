import AdminPage from "./app/AdminPage";
import { App } from "./app/App";
import { db, setupDb } from "./db";
import HomePage from "./app/HomePage";
import { transformRscToHtmlStream } from "./render/transformRscToHtmlStream";
import { injectRSCPayload } from "rsc-html-stream/server";
import { renderToRscStream } from "./render/renderToRscStream";
import { rscActionHandler } from "./register/rsc";

// todo(peterp, 2024-11-25): Make these lazy.
const routes = {
  "/": HomePage,
  "/admin": AdminPage,
};

export default {
  async fetch(request: Request, env: Env) {
    try {
      const url = new URL(request.url);

      const isRSCRequest = url.searchParams.has("__rsc");
      const isRSCActionHandler = url.searchParams.has("__rsc_action_id");

      if (isRSCActionHandler) {
        await rscActionHandler(request);
      }

      if (url.pathname.startsWith("/assets/")) {
        url.pathname = url.pathname.slice("/assets/".length);
        return env.ASSETS.fetch(new Request(url.toString(), request));
      }

      setupDb(env);

      if (request.method === "POST" && request.url.includes("/api/login")) {
        console.log("Login request received");
        return new Response("Login successful", { status: 200 });
      }

      if (
        request.method === "POST" &&
        request.url.includes("/api/create-user")
      ) {
        const formData = await request.formData();
        const name = formData.get("name");
        const cell = formData.get("cell") as string;

        const user = await db
          .insertInto("User")
          .values({
            name: name as string,
            cellnumber: cell,
          })
          .execute();

        if (!user) {
          return new Response("User creation failed", { status: 500 });
        }

        const referer = request.headers.get("Referer") || "/admin";
        return Response.redirect(referer, 303);
      }

      const pathname = new URL(request.url).pathname as keyof typeof routes;
      const Page = routes[pathname];
      if (!Page) {
        // todo(peterp, 2024-11-25): Return not found page, if exists
        return new Response("Not found", { status: 404 });
      }

      const rscPayloadStream = renderToRscStream(
        <App>
          <Page />
        </App>,
      );

      if (isRSCRequest) {
        return new Response(rscPayloadStream, {
          headers: { "content-type": "text/x-component; charset=utf-8" },
        });
      }

      const [rscPayloadStream1, rscPayloadStream2] = rscPayloadStream.tee();
      const htmlStream = await transformRscToHtmlStream(rscPayloadStream1);
      const html = htmlStream.pipeThrough(injectRSCPayload(rscPayloadStream2));
      return new Response(html, {
        headers: { "content-type": "text/html" },
      });
    } catch (e) {
      console.error("Unhandled error", e);
      throw e;
    }
  },
};
