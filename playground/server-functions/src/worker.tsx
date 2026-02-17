import { except, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { ErrorPage } from "@/app/pages/ErrorPage";
import { Home } from "@/app/pages/Home";
import { RedirectSuccess } from "@/app/pages/RedirectSuccess";

export type AppContext = {};

export default defineApp([
  // setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  except((error, { request }) => {
    console.log("[worker] except handler caught error:", error);
    const errorUrl = new URL("/error", request.url).toString();
    console.log("[worker] redirecting to:", errorUrl);
    return Response.redirect(errorUrl, 302);
  }),
  render(Document, [
    route("/", Home),
    route("/redirect-success", RedirectSuccess),
    route("/error", ErrorPage),
    route("/debug/throw", () => {
      throw new Error("This is a test error from the /debug/throw route");
    }),
  ]),
]);
