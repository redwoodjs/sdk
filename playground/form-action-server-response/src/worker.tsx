import { defineApp } from "rwsdk/worker";
import { render, route } from "rwsdk/router";

import { Document } from "@/app/Document";
import { Home } from "@/app/pages/Home";
import { Test } from "@/app/pages/Test";

export type AppContext = {};

export default defineApp([
  render(Document, [route("/", Home)]),
  route("/test", Test),
]);
