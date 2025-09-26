import { defineApp, renderToStream } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { setCommonHeaders } from "@/app/headers";
import { RenderToStream } from "./app/pages/RenderToStream.js";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  render(Document, [route("/", Home)]),
  route("/render-to-stream", async () => {
    return new Response(
      await renderToStream(<RenderToStream />, {
        Document,
      }),
      {
        status: 200,
        headers: {
          "content-type": "text/html",
          "cache-control": "no-transform",
        },
      },
    );
  }),
]);
