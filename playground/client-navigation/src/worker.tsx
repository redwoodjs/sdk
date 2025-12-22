import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { About } from "@/app/pages/About";
import { Home } from "@/app/pages/Home";
import { SuspensePageOne } from "@/app/pages/SuspensePageOne";
import { SuspensePageTwo } from "@/app/pages/SuspensePageTwo";

export type AppContext = {};

export default defineApp([
  // setCommonHeaders(),
  ({ ctx }) => {
    // setup ctx here
    ctx;
  },
  render(Document, [
    route("/", Home),
    route("/about", About),
    route("/suspense-one", SuspensePageOne),
    route("/suspense-two", SuspensePageTwo),
  ]),
]);
