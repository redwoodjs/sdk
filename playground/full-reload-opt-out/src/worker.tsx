import { render, route } from "rwsdk/router";
import { defineApp } from "rwsdk/worker";

import { Document } from "@/app/Document";
import { AdminPage } from "@/app/pages/AdminPage";
import { AdminDetailsPage } from "@/app/pages/AdminDetailsPage";
import { HomePage } from "@/app/pages/HomePage";

export type AppContext = {};

export default defineApp([
  render(Document, [
    route("/", HomePage),
    route("/admin", AdminPage),
    route("/admin/details", AdminDetailsPage),
  ]),
]);
