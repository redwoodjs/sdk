import { render, route } from "rwsdk/router";
import { defineApp, renderToStream } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
  ]),
  route("/stream", async () => {
    return new Response(await renderToStream(<Home />, { Document }), {
      status: 200,
      headers: {
        "content-type": "text/html",
        "cache-control": "no-transform",
      },
    });
  }),
]);
