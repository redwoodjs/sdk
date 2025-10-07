import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { setCommonHeaders } from "@/app/headers";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp<RequestInfo<AppContext>>([
  // Middleware
  setCommonHeaders(),

  // Route handlers
  route("/", Home),
  route("/short-circuit", () => {
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  }),
  render(Document),
]);
