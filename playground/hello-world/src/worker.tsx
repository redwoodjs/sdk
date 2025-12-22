import { except, render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { ErrorPage } from "@/app/pages/ErrorPage";
import { Home } from "@/app/pages/Home";

export type AppContext = {};

export default defineApp([
  // setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  except((error) => {
    return <ErrorPage error={error} />;
  }),
  render(Document, [
    route("/", Home),
    route("/error", ErrorPage),
    route("/debug/throw", () => {
      throw new Error("This is a test error from the /debug/throw route");
    }),
  ]),
]);
