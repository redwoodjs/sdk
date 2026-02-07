import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { ErrorPage } from "@/app/pages/error-page";
import { HomePage } from "@/app/pages/home-page";
import { RedirectPage } from "@/app/pages/redirect-page";

export type AppContext = {};

export default defineApp([

  render(Document, [
    route("/", HomePage),
    route("/error", ErrorPage),
    route("/redirect", RedirectPage),
    route("/debug/throw", () => {
      throw new Error("This is a test error from the /debug/throw route");
    }),
  ]),
  // except(() => {
  //   // Unhandled exceptions.
  //   // return new Response(null, { headers: { location: "/error" }, status: 302 });
  // }),
]);
