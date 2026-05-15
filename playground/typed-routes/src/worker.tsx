import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { BlogPost } from "@/app/pages/BlogPost";
import { FileViewer } from "@/app/pages/FileViewer";
import { Home } from "@/app/pages/Home";
import { UserProfile } from "@/app/pages/UserProfile";
import { link } from "@/app/shared/links";

export type AppContext = {};

// NOTE(peterp, 2025-12-03): Ensuring this resolves the [issue #900](https://github.com/redwoodjs/sdk/pull/900)
export const app = defineApp([
  setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },

  render(Document, [
    route("/old", ({ request }): Response => {
      const url = new URL(request.url);
      const redirectUrl: URL = new URL(
        link("/users/:id", { id: "123" }),
        url.origin,
      );
      return Response.redirect(redirectUrl.toString(), 301);
    }),
    route("/", Home),
    route("/users/:id", UserProfile),
    route("/files/*", FileViewer),
    route("/blog/:year/:slug", BlogPost),
  ]),
]);

export default {
  fetch: app.fetch,
};
